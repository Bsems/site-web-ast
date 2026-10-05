import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const { monthDays } = createRequire(import.meta.url)('../permanences.js');

test('semaines du lundi au dimanche et février bissextile', () => {
  const days = monthDays(2028, 1, []);
  assert.equal(days[0], null);
  assert.equal(days[1].day, 1);
  assert.equal(days.filter(Boolean).length, 29);
  assert.equal(days.length % 7, 0);
});
test('plusieurs permanences le même jour, sans confusion de mois ou année', () => {
  const events = [{ date: '2027-01-03' }, { date: '2027-01-03' }, { date: '2026-01-03' }, { date: '2027-02-03' }];
  const days = monthDays(2027, 0, events);
  assert.equal(days.find(day => day?.day === 3).events.length, 2);
  assert.equal(days.find(day => day?.day === 4).events.length, 0);
  assert.equal(monthDays(2026, 11, events).filter(Boolean).length, 31);
});
test('la page embarque les données JSON actualisées pour une ouverture locale', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('data/inscriptions-source.json', root), 'utf8'));
  const page = await readFile(new URL('inscription.html', root), 'utf8');
  const embedded = page.match(/<script id="permanences-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.deepEqual(JSON.parse(embedded[1]), data.permanences);
  assert.doesNotMatch(page, /Mercredi 8 juillet|vendredi 10 juillet|data-registration-value="permanenceDates"/);
});
