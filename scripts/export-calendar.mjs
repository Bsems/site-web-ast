/**
 * Export hors réseau : calendar.json + ffbb-config.json + equipes.json
 * -> calendar-data.js, equipes-data.js et listes de equipes.html.
 * Appelable en CLI ou via exportCalendar(root).
 * Les équipes visibles viennent de displayTeams, pas du nombre d'engagements API.
 */
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function exportCalendar(root = new URL('../', import.meta.url)) {
  const data = JSON.parse(await readFile(new URL('data/calendar.json', root), 'utf8'));
  const config = JSON.parse(await readFile(new URL('data/ffbb-config.json', root), 'utf8'));
  const content = JSON.parse(await readFile(new URL('data/equipes.json', root), 'utf8'));
  if (!Array.isArray(data.matches) || !Array.isArray(data.teams)) throw new Error('Données calendrier invalides.');
  if (!Array.isArray(config.displayTeams) || !config.displayTeams.length ||
      new Set(config.displayTeams.map(team => `${team.category}:${team.name}`)).size !== config.displayTeams.length) throw new Error('Liste des équipes à afficher invalide.');
  if (new Set(config.displayTeams.map(team => team.slug)).size !== config.displayTeams.length) throw new Error('Slug d’équipe dupliqué.');
  if (!content.teams || typeof content.teams !== 'object') throw new Error('Contenu des équipes invalide.');
  // Garder toute équipe configurée, même si aucun engagement ne fournit son lien.
  const displayTeams = [];
  for (const team of config.displayTeams) {
    const engagement = data.teams.find(item => item.id === team.engagementId);
    if (!team.name || !['young', 'senior'].includes(team.category)) throw new Error(`Équipe à afficher invalide : ${team.name}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(team.slug || '')) throw new Error(`Slug d’équipe invalide : ${team.name}`);
    displayTeams.push({ ...team, source: engagement?.source || null, ...await teamContent(root, team.slug, content.teams[team.slug]) });
  }
  const unknown = Object.keys(content.teams).filter(slug => !displayTeams.some(team => team.slug === slug));
  if (unknown.length) throw new Error(`Contenu pour une équipe inconnue : ${unknown.join(', ')}`);
  // Affectation globale pour file:// ; ne jamais modifier la copie JS à la main.
  const temporary = new URL('data/calendar-data.js.tmp', root);
  await writeFile(temporary, '// Généré depuis calendar.json ; ne pas modifier directement.\nwindow.AST_CALENDAR = ' + JSON.stringify(data, null, 2) + ';\n');
  await rename(temporary, new URL('data/calendar-data.js', root));
  // Copie navigateur des équipes et de leur contenu, lue par equipe.js.
  const teamsTemporary = new URL('data/equipes-data.js.tmp', root);
  await writeFile(teamsTemporary, '// Généré depuis ffbb-config.json et equipes.json ; ne pas modifier directement.\nwindow.AST_TEAMS = ' + JSON.stringify(displayTeams, null, 2) + ';\n');
  await rename(teamsTemporary, new URL('data/equipes-data.js', root));
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
      // Chaque équipe a sa page interne ; le lien FFBB y est repris.
      return `              <li><a href="equipe.html?equipe=${escape(team.slug)}"><strong>${escape(team.name)}</strong></a></li>`;
    }).join('\n');
    const pattern = new RegExp(`(<ul class="category-team-list" data-ffbb-category="${category}">)[\\s\\S]*?(</ul>)`);
    if (!pattern.test(html)) throw new Error(`Emplacement des équipes manquant : ${category}`);
    html = html.replace(pattern, (_, start, end) => start + '\n' + list + '\n            ' + end);
  }
  await writeFile(teamsPath, html);
}
/*
 * Valider le contenu manuel d'une équipe (equipes.json) : sections absentes = vides.
 * Les photos sont des fichiers locaux existants sous Image_AST/equipes/.
 */
async function teamContent(root, slug, entry = {}) {
  const text = (value, label) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error(`${slug} : ${label} invalide`);
    return value.trim();
  };
  const photo = async value => {
    const path = text(value, 'photo');
    if (!path) return null;
    if (!/^Image_AST\/equipes\/[\w./-]+\.(jpe?g|png|webp)$/i.test(path) || path.includes('..')) throw new Error(`${slug} : photo hors de Image_AST/equipes/ : ${path}`);
    await access(new URL(path, root)).catch(() => { throw new Error(`${slug} : photo introuvable : ${path}`); });
    return path;
  };
  const list = (value, label) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${slug} : ${label} doit être une liste`);
    return value;
  };
  const staff = [];
  for (const person of list(entry.staff, 'staff')) {
    if (!text(person?.name, 'nom du staff')) throw new Error(`${slug} : membre du staff sans nom`);
    staff.push({ name: text(person.name, 'nom'), role: text(person.role, 'rôle'), photo: await photo(person.photo) });
  }
  const roster = [];
  for (const player of list(entry.roster, 'effectif')) {
    if (!text(player?.name, 'nom du joueur')) throw new Error(`${slug} : joueur sans nom`);
    roster.push({ name: text(player.name, 'nom'), number: text(player.number === undefined ? undefined : String(player.number), 'numéro'),
      position: text(player.position, 'poste'), height: text(player.height, 'taille'), photo: await photo(player.photo) });
  }
  return { photo: await photo(entry.photo), staff, roster };
}
// Éviter un export automatique lorsque le module est importé par le lanceur.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await exportCalendar();
