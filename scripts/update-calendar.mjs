// Import manuel : node scripts/update-calendar.mjs ; seul un import complet remplace les données.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readMatches } from './ffbb-source.mjs';

// Résoudre les chemins depuis ce module, indépendamment du dossier de lancement.
const root = new URL('../', import.meta.url);
const base = 'https://competitions.ffbb.com';
const club = base + '/ligues/occ/comites/0031/clubs/occ0031039';
// Télécharger une page FFBB avec un délai maximal et refuser les réponses HTTP en erreur.
async function page(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`FFBB ${response.status}: ${url}`);
  return response.text();
}
// Les liens de equipes.html définissent les poules attendues et les libellés des équipes.
const local = await readFile(new URL('equipes.html', root), 'utf8');
const links = [...local.matchAll(/<a href="([^"]+)"[^>]*><strong>([^<]+)<\/strong>/g)];
const clubHtml = await page(club);
// Découvrir les pages des équipes du club et éliminer les liens en double.
const teamPaths = [...new Set([...clubHtml.matchAll(/href="([^"?]*\/clubs\/occ0031039\/equipes\/\d+)"/g)].map(m => m[1]))];
const wanted = new Map(links.map(m => [m[1].replace(/&amp;/g, '&'), m[2]]));
const found = new Map();
const games = new Map();
// Effectuer les requêtes successivement pour limiter la charge du service public FFBB.
for (const path of teamPaths) {
  const html = await page(base + path);
  // Associer la poule trouvée sur la FFBB à une équipe publiée sur notre site.
  const groupPath = html.match(/href="([^"]*\?poule=[^"]+)"/)?.[1];
  if (!groupPath) continue;
  const group = new URL(groupPath.replace(/&amp;/g, '&'), base).href;
  const label = wanted.get(group);
  if (!label) continue;
  const id = path.split('/').at(-1);
  const matches = readMatches(html);
  if (!matches.length) throw new Error(`Aucune rencontre extraite pour ${label}; données précédentes conservées.`);
  let count = 0;
  for (const match of matches) {
    // Conserver uniquement les rencontres auxquelles participe cette équipe du club.
    const home = match.idEngagementEquipe1;
    const away = match.idEngagementEquipe2;
    if (home?.id !== id && away?.id !== id) continue;
    if (!home.nom || !away.nom) throw new Error(`Équipes manquantes: ${match.id}`);
    const date = match.date_rencontre;
    // Les dates FFBB sans fuseau représentent les horaires locaux français.
    // Conserver ces horaires tels quels pour l’affichage dans le navigateur.
    if (date && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date)) throw new Error(`Date inconnue: ${date}`);
    // Normaliser les scores numériques ; une valeur absente ou inconnue devient null.
    const score = value => /^\d+$/.test(String(value)) ? Number(value) : null;
    const homeScore = score(match.resultatEquipe1);
    const awayScore = score(match.resultatEquipe2);
    const played = match.joue === true;
    // Construire le format commun au navigateur en conservant l’ordre domicile / extérieur.
    const record = { id: match.id, team: label, date: date || null,
      home: home.nom, away: away.nom, atHome: home.id === id,
      played, homeScore: played ? homeScore : null, awayScore: played ? awayScore : null,
      round: match.numeroJournee || null,
      url: new URL(match.url_competition, base).href };
    if (!record.url.startsWith(base + '/')) throw new Error('Lien de rencontre invalide');
    games.set(record.id, record);
    count++;
  }
  found.set(label, { label, source: base + path, group, count });
  console.log(`${label}: ${count} rencontres`);
}
// Refuser un import incomplet avant toute écriture pour conserver le dernier instantané valide.
if (found.size !== wanted.size || !games.size) throw new Error('Import incomplet; données précédentes conservées.');
// Ajouter la provenance et la date de collecte ; placer les matchs sans date à la fin.
const payload = { updatedAt: new Date().toISOString(), source: club,
  teams: [...found.values()], matches: [...games.values()].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) };
await mkdir(new URL('data/', root), { recursive: true });
const target = new URL('data/calendar-data.js', root);
// Écrire un fichier temporaire puis le renommer pour éviter un fichier final partiellement écrit.
const temporary = new URL('data/calendar-data.js.tmp', root);
await writeFile(temporary, `// Généré par node scripts/update-calendar.mjs ; ne pas modifier les données à la main.\nwindow.AST_CALENDAR = ${JSON.stringify(payload, null, 2)};\n`);
await rename(temporary, target);
console.log(`${payload.matches.length} rencontres enregistrées.`);
