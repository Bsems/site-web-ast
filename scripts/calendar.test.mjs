/**
 * Tests hors réseau : node --test scripts/calendar.test.mjs.
 * Couverture : dates et scores, échec du lanceur, cohérence JSON/copie JS.
 * Les assertions sur les matchs versionnés sont des témoins historiques :
 * les remplacer par des résultats vérifiés lors d'un changement de saison.
 * Cette suite ne monte pas le DOM et ne vérifie donc pas le rendu CSS du score.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import calendar from '../calendar.js';

// Vérifier les lundis aux limites d’année et lors du changement d’heure.
test('Weeks start Monday and cross year and DST boundaries correctly', () => {
  assert.equal(calendar.monday('2027-01-03'), '2026-12-28');
  assert.equal(calendar.monday('2027-01-04'), '2027-01-04');
  assert.equal(calendar.monday('2026-10-25'), '2026-10-19');
  assert.equal(calendar.shift('2026-10-19', 7), '2026-10-26');
});
// Vérifier le regroupement de plusieurs équipes, le tri et l’exclusion des dates absentes.
test('Different teams share a week and are sorted by French local date/time', () => {
  const late = { team: 'NF2', date: '2026-09-26T20:00:00' };
  const early = { team: 'U15', date: '2026-09-26T13:00:00' };
  const groups = calendar.groupWeeks([late, { date: null }, early]);
  assert.equal(groups.size, 1);
  assert.deepEqual(groups.get('2026-09-21'), [early, late]);
});
// Distinguer les matchs à venir, les scores manquants et un score nul réellement joué.
test('Only played matches display scores, including a genuine zero', () => {
  assert.equal(calendar.result({ played: false, homeScore: 0, awayScore: 0, date: '2026-09-26T20:00:00' }, '2026-09-22'), 'À venir');
  assert.equal(calendar.result({ played: false, homeScore: 0, awayScore: 0, date: '2026-09-19T20:00:00' }, '2026-09-22'), 'Score indisponible');
  assert.equal(calendar.result({ played: true, homeScore: 0, awayScore: 20 }, '2026-09-22'), '0 – 20');
  assert.equal(calendar.result({ played: false, date: '2026-09-22T20:00:00' }, '2026-09-22'), 'Aujourd’hui');
});
// L'issue se lit du point de vue de l'AST, à domicile comme à l'extérieur.
test('Outcome follows the AST side, not the score order', () => {
  assert.equal(calendar.outcome({ played: true, atHome: false, homeScore: 53, awayScore: 65 }, '2026-10-08'), 'win');
  assert.equal(calendar.outcome({ played: true, atHome: true, homeScore: 53, awayScore: 65 }, '2026-10-08'), 'loss');
  assert.equal(calendar.outcome({ played: true, atHome: true, homeScore: 60, awayScore: 60 }, '2026-10-08'), 'draw');
  assert.equal(calendar.outcome({ played: false, date: '2026-10-08T20:00:00' }, '2026-10-08'), 'today');
  assert.equal(calendar.outcome({ played: false, date: '2026-10-10T20:00:00' }, '2026-10-08'), 'upcoming');
  assert.equal(calendar.outcome({ played: true, atHome: true, date: '2026-10-01T20:00:00' }, '2026-10-08'), 'unknown');
});
// Les initiales remplacent un logo absent ; seule une URL FFBB issue d'un UUID est produite.
test('Crest fallback initials and logo URLs are safe', () => {
  assert.equal(calendar.initials('IE - BASKET CLUB LOURDAIS - 2'), 'L');
  assert.equal(calendar.initials('TARBES UNION BASKET 65 - 3'), 'TU');
  assert.equal(calendar.initials('BC'), 'B');
  assert.equal(calendar.initials(''), '?');
  assert.equal(calendar.logoUrl('74983c7e-1f1f-4c55-8d28-d4cdc929448a'),
    'https://api.ffbb.app/assets/74983c7e-1f1f-4c55-8d28-d4cdc929448a?width=128&height=128&fit=inside&format=webp');
  for (const value of [null, undefined, '', '../x', 'https://evil.example/a.png', 42]) assert.equal(calendar.logoUrl(value), null);
});
test('Missing scores never display undefined', () => {
  assert.equal(calendar.result({ played: true }, '2026-10-02'), 'Score indisponible');
});

test('A failed Python import preserves the JSON, local copy and team page', async () => {
  const root = new URL('../', import.meta.url);
  const paths = ['data/calendar.json', 'data/calendar-data.js', 'equipes.html'].map(p => new URL(p, root));
  const before = await Promise.all(paths.map(p => readFile(p)));
  await assert.rejects(promisify(execFile)(process.execPath, [fileURLToPath(new URL('scripts/update-calendar.mjs', root))], {
    // Node cannot execute the Python importer: fail before any network request.
    env: { ...process.env, FFBB_PYTHON: process.execPath },
  }));
  const after = await Promise.all(paths.map(p => readFile(p)));
  assert.deepEqual(after, before);
});
// Contrôler l’instantané versionné : couverture des équipes, unicité, liens et orientation des scores.
test('API snapshot and local export agree and preserve score orientation', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../data/calendar-data.js', import.meta.url), 'utf8'), context);
  const data = context.window.AST_CALENDAR;
  const json = JSON.parse(await readFile(new URL('../data/calendar.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(data)), json);
  assert.equal(data.sourceType, 'api');
  assert.equal(data.client, 'ffbb-api-client-v2');
  assert.ok(data.teams.length >= 10);
  assert.equal(new Set(data.matches.map(m => m.id)).size, data.matches.length);
  assert.equal(data.teams.reduce((sum, team) => sum + team.count, 0), data.matches.length);
  for (const match of data.matches) {
    assert.match(match.atHome ? match.home : match.away, /TOURNEFEUILLE/);
    assert.match(match.url, /^https:\/\/competitions\.ffbb\.com\//);
    if (!match.played) { assert.equal(match.homeScore, null); assert.equal(match.awayScore, null); }
  }
  const known = data.matches.find(m => m.id === '200000014601105');
  assert.equal(known.date, '2026-09-19T20:00:00');
  assert.equal(known.homeScore, 49);
  assert.equal(known.awayScore, 74);
  // Régression : cette rencontre récente n’était pas couverte par l’ancien import.
  const recent = data.matches.find(m => m.id === '200000014837301');
  assert.ok(recent, 'Le résultat du 3 octobre doit être conservé même sans engagement listé.');
  assert.equal(recent.date, '2026-10-03T17:00:00');
  assert.equal(calendar.result(recent, '2026-10-05'), '78 – 46');
});
// Pages équipe : une entrée par displayTeams, slug unique, lien interne et contenu vide toléré.
test('Team pages export one linked entry per displayed team', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../data/equipes-data.js', import.meta.url), 'utf8'), context);
  const teams = JSON.parse(JSON.stringify(context.window.AST_TEAMS));
  const config = JSON.parse(await readFile(new URL('../data/ffbb-config.json', import.meta.url), 'utf8'));
  const html = await readFile(new URL('../equipes.html', import.meta.url), 'utf8');
  assert.deepEqual(teams.map(team => team.slug), config.displayTeams.map(team => team.slug));
  assert.equal(new Set(teams.map(team => team.slug)).size, teams.length);
  for (const team of teams) {
    assert.match(team.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(Array.isArray(team.staff) && Array.isArray(team.roster));
    assert.ok(html.includes(`href="equipe.html?equipe=${team.slug}"`), `Lien manquant pour ${team.slug}`);
  }
});
