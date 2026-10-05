import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FfbbApi, normalizeMatch, importCalendar } from './ffbb-client.mjs';

const team = { id: '10', label: 'NF2', source: 'https://competitions.ffbb.com/clubs/ast/equipes/10', pouleId: '20' };
const match = { ffbbMatchId: '30', pouleId: '20', isHome: false, opponent: 'Adversaire', location: 'Gymnase' };
const result = { id: '30', joue: 1, resultatEquipe1: '0', resultatEquipe2: '20', date_rencontre: '2026-09-26T20:00:00', nomEquipe1: 'Adversaire', nomEquipe2: 'AST' };
test('scores de poule numériques, forfait zéro et ordre domicile/extérieur', () => {
  const normalized = normalizeMatch(match, result, team, 'AST');
  assert.equal(normalized.homeScore, 0);
  assert.equal(normalized.awayScore, 20);
  assert.equal(normalized.atHome, false);
  assert.equal(normalized.date, result.date_rencontre);
});
test('masquer les faux 0–0 futurs et accepter les valeurs None de l’API', () => {
  assert.equal(normalizeMatch(match, { ...result, joue: 0 }, team, 'AST').homeScore, null);
  assert.equal(normalizeMatch(match, { ...result, resultatEquipe1: 'None' }, team, 'AST').homeScore, null);
  assert.throws(() => normalizeMatch(match, null, team, 'AST'), /absent/);
  assert.throws(() => normalizeMatch(match, { ...result, joue: 'inconnu' }, team, 'AST'), /Statut/);
});
test('échec explicite en cas de refus HTTP', async () => {
  const api = new FfbbApi({ fetchImpl: async () => new Response('{}', { status: 403 }) });
  await assert.rejects(api.request('/api/v1/club/12343/teams'), /HTTP 403/);
});
const config = { baseUrl: 'https://ffbb-api.desimone.fr', club: { id: 12343, url: 'https://competitions.ffbb.com/clubs/ast' }, teamLabels: { 10: 'NF2' } };
function fakeApi(overrides = {}) {
  const responses = {
    '/api/v1/club/12343/teams': { organisme_id: 12343, nom: 'AST', count: 1, teams: [{ engagement_id: '10', poule_id: '20', team_number: '1', competition: 'NF2' }] },
    '/api/v1/club/12343/matches': { organisme_id: 12343, count: 1, matches: [match] },
    '/api/v1/poule/20': { id: '20', nom: 'A', rencontres: [result], classements: null },
    ...overrides,
  };
  return { request: async path => responses[path] };
}
test('import croisé des équipes, rencontres et résultats sans classement de coupe', async () => {
  const data = await importCalendar(fakeApi(), config);
  assert.equal(data.matches[0].awayScore, 20);
  assert.equal(data.teams[0].count, 1);
  assert.deepEqual(data.standings[0].rows, []);
});
test('refuser un import incomplet, un autre club ou des doublons', async () => {
  await assert.rejects(importCalendar(fakeApi({ '/api/v1/club/12343/matches': { organisme_id: 12343, count: 2, matches: [match] } }), config), /incomplet/);
  await assert.rejects(importCalendar(fakeApi({ '/api/v1/club/12343/matches': { organisme_id: 9, count: 1, matches: [match] } }), config), /incorrect/);
  await assert.rejects(importCalendar(fakeApi({ '/api/v1/club/12343/matches': { organisme_id: 12343, count: 2, matches: [match, match] } }), config), /dupliquée/);
});
