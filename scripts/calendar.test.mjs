// Tests hors réseau : lancer node --test scripts/calendar.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import calendar from '../calendar.js';
import { readMatches } from './ffbb-source.mjs';

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
  assert.equal(calendar.result({ played: false, homeScore: 0, awayScore: 0, date: '2026-09-19T20:00:00' }, '2026-09-22'), 'Score non publié');
  assert.equal(calendar.result({ played: true, homeScore: 0, awayScore: 20 }, '2026-09-22'), '0 – 20');
  assert.equal(calendar.result({ played: false, date: '2026-09-22T20:00:00' }, '2026-09-22'), 'Aujourd’hui');
});
// Simuler un fragment FFBB pour tester les références React et une page sans données.
test('FFBB parser resolves React references without executing remote scripts', () => {
  const record = '1:' + JSON.stringify({ team: { id: 'AST', nom: 'Tournefeuille' }, games: [{ id: 'm1', date_rencontre: '2026-09-19T20:00:00', idEngagementEquipe1: '$1:team', idEngagementEquipe2: { id: 'other', nom: 'Other' } }] }) + '\n';
  const html = '<script>self.__next_f.push(' + JSON.stringify([1, record]) + ')</script>';
  const matches = readMatches(html);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].idEngagementEquipe1.nom, 'Tournefeuille');
  assert.deepEqual(readMatches('<html>Server error</html>'), []);
});
// Contrôler l’instantané versionné : couverture des équipes, unicité, liens et orientation des scores.
test('Imported data covers ten teams, unique games, and preserves score orientation', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../data/calendar-data.js', import.meta.url), 'utf8'), context);
  const data = context.window.AST_CALENDAR;
  assert.equal(data.teams.length, 10);
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
});
