/**
 * Export hors réseau : calendar.json + ffbb-config.json -> calendar-data.js
 * et listes de equipes.html. Appelable en CLI ou via exportCalendar(root).
 * Les équipes visibles viennent de displayTeams, pas du nombre d'engagements API.
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function exportCalendar(root = new URL('../', import.meta.url)) {
  const data = JSON.parse(await readFile(new URL('data/calendar.json', root), 'utf8'));
  const config = JSON.parse(await readFile(new URL('data/ffbb-config.json', root), 'utf8'));
  if (!Array.isArray(data.matches) || !Array.isArray(data.teams)) throw new Error('Données calendrier invalides.');
  if (!Array.isArray(config.displayTeams) || !config.displayTeams.length ||
      new Set(config.displayTeams.map(team => `${team.category}:${team.name}`)).size !== config.displayTeams.length) throw new Error('Liste des équipes à afficher invalide.');
  // Garder toute équipe configurée, même si aucun engagement ne fournit son lien.
  const displayTeams = config.displayTeams.map(team => {
    const engagement = data.teams.find(item => item.id === team.engagementId);
    if (!team.name || !['young', 'senior'].includes(team.category)) throw new Error(`Équipe à afficher invalide : ${team.name}`);
    return { ...team, source: engagement?.source || null };
  });
  // Affectation globale pour file:// ; ne jamais modifier la copie JS à la main.
  const temporary = new URL('data/calendar-data.js.tmp', root);
  await writeFile(temporary, '// Généré depuis calendar.json ; ne pas modifier directement.\nwindow.AST_CALENDAR = ' + JSON.stringify(data, null, 2) + ';\n');
  await rename(temporary, new URL('data/calendar-data.js', root));
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const teamsPath = new URL('equipes.html', root);
  let html = await readFile(teamsPath, 'utf8');
  /*
   * Les sélecteurs ci-dessous sont aussi des repères de génération : conserver
   * la classe category-team-list et data-ffbb-category dans le HTML.
   * Une erreur à ce stade peut survenir après l'écriture de calendar-data.js.
   */
  for (const category of ['young', 'senior']) {
    const list = displayTeams.filter(team => team.category === category).map(team => {
      const name = `<strong>${escape(team.name)}</strong>`;
      const entry = team.source
        ? `<a href="${escape(team.source)}" target="_blank" rel="noopener noreferrer">${name}</a>`
        : `<div class="category-team-entry">${name}</div>`;
      return `              <li>${entry}</li>`;
    }).join('\n');
    const pattern = new RegExp(`(<ul class="category-team-list" data-ffbb-category="${category}">)[\\s\\S]*?(</ul>)`);
    if (!pattern.test(html)) throw new Error(`Emplacement des équipes manquant : ${category}`);
    html = html.replace(pattern, (_, start, end) => start + '\n' + list + '\n            ' + end);
  }
  await writeFile(teamsPath, html);
}
// Éviter un export automatique lorsque le module est importé par le lanceur.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await exportCalendar();
