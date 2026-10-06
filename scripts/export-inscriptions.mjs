/**
 * Actualiser inscription.html depuis data/inscriptions-source.json, hors réseau.
 * Les textes éditoriaux restent manuels ; seuls les attributs data-registration-*
 * et le bloc JSON #permanences-data sont remplacés. Les dates gardent leur année
 * dans les données, sans imposer son affichage dans la rubrique inscription.
 */
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/inscriptions-source.json', root), 'utf8'));
const pagePath = new URL('inscription.html', root);
let page = await readFile(pagePath, 'utf8');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// La base fictive sert uniquement à valider aussi les liens relatifs et les ancres.
const links = { ...data.links, contact: `mailto:${data.contactEmail}` };
for (const [key, value] of Object.entries(links)) {
  const url = new URL(value, 'https://ast.invalid/');
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error(`Lien invalide : ${key}`);
}
// Préserver les attributs du lien, puis remplacer href avec une valeur échappée.
page = page.replace(/<a\b([^>]*\bdata-registration-link="([^"]+)"[^>]*)>/g, (tag, attrs, key) => {
  if (!Object.hasOwn(links, key)) throw new Error(`Lien manquant : ${key}`);
  return `<a${attrs.replace(/\s+href="[^"]*"/, '')} href="${escape(links[key])}">`;
});
const values = {
  contact: data.contactEmail,
  payments: data.paymentMethods.join(', '),
};
for (const [key, value] of Object.entries(values)) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Information manquante : ${key}`);
  const pattern = new RegExp(`(<span data-registration-value="${key}">)[^<]*(</span>)`, 'g');
  if (!pattern.test(page)) throw new Error(`Emplacement manquant : ${key}`);
  page = page.replace(pattern, (_, start, end) => start + escape(value) + end);
}
/*
 * Vérifier date civile, heures HH:MM et ordre début/fin. Une permanence ne peut
 * pas traverser minuit avec ce format ; aucune liste non validée n'est écrite.
 */
if (!Array.isArray(data.permanences)) throw new Error('Liste des permanences manquante');
for (const event of data.permanences) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      new Date(event.date + 'T12:00:00Z').toISOString().slice(0, 10) !== event.date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.end) || event.end <= event.start ||
      typeof event.location !== 'string' || !event.location.trim()) {
    throw new Error('Permanence invalide : date, horaires ou lieu');
  }
}
// Échapper « < » empêche une donnée de fermer prématurément la balise script.
const calendarPattern = /(<script id="permanences-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!calendarPattern.test(page)) throw new Error('Emplacement du calendrier manquant');
page = page.replace(calendarPattern, (_, start, end) => start + JSON.stringify(data.permanences).replaceAll('<', '\\u003c') + end);
await writeFile(pagePath, page, 'utf8');
console.log('Page inscription actualisée depuis data/inscriptions-source.json.');
