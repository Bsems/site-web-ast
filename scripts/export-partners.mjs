/**
 * Générer window.AST_PARTNERS pour l'ouverture locale de partenaires.html.
 * Source unique : data/partners.json. Vérifier les identités, images locales et
 * protocoles des liens avant toute écriture ; aucune URL externe n'est consultée.
 */
import { readFile, writeFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/partners.json', root), 'utf8'));
// Interdire les doublons et les images hors du dossier Partenaires.
const ids = new Set();
if (!Array.isArray(data.partners) || !data.partners.length) throw new Error('Liste de partenaires vide.');
for (const partner of data.partners) {
  if (!partner.id || ids.has(partner.id) || !partner.name) throw new Error('Identité de partenaire invalide.');
  ids.add(partner.id);
  if (!/^Partenaires\/[^/\\]+\.(png|jpe?g)$/i.test(partner.image)) throw new Error('Chemin image invalide.');
  await access(new URL(partner.image, root));
  for (const link of partner.links) {
    if (!link.label || new URL(link.url).protocol !== 'https:' || typeof link.enabled !== 'boolean') {
      throw new Error('Lien invalide pour ' + partner.name);
    }
  }
}
// Garder le commentaire de provenance dans la sortie générée, sans y éditer les données.
await writeFile(new URL('data/partners-data.js', root),
  '// Généré par node scripts/export-partners.mjs — modifier partners.json.\nwindow.AST_PARTNERS = ' +
  JSON.stringify(data, null, 2) + ';\n');
console.log(data.partners.length + ' partenaires exportés, images et liens vérifiés.');
