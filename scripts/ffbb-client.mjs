export class FfbbApi {
  constructor({ baseUrl = 'https://ffbb-api.desimone.fr', fetchImpl = fetch } = {}) {
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
  }
  async request(path) {
    const response = await this.fetch(new URL(path, this.baseUrl), {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`API FFBB : HTTP ${response.status}. Données précédentes conservées.`);
    const payload = await response.json();
    if (!payload || payload.detail || payload.error) throw new Error('Réponse API FFBB invalide.');
    return payload;
  }
}

export function normalizeMatch(match, result, team, clubName) {
  if (!match.ffbbMatchId || typeof match.isHome !== 'boolean' || !match.opponent) throw new Error('Rencontre API invalide.');
  if (!result || String(result.id) !== String(match.ffbbMatchId)) throw new Error(`Résultat absent de la poule : ${match.ffbbMatchId}`);
  if (![0, 1, false, true].includes(result.joue)) throw new Error('Statut API joue inconnu.');
  const date = result.date_rencontre || null;
  if (date && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(date) || Number.isNaN(Date.parse(date)))) throw new Error('Date API inconnue : horaire local FFBB attendu.');
  const score = value => value !== null && value !== undefined && /^\d+$/.test(String(value)) ? Number(value) : null;
  const played = result.joue === 1 || result.joue === true;
  // Les routes du fournisseur ne donnent pas de lien de fiche match. Le lien
  // officiel de l'engagement est stable et fourni dans les données exportées.
  return {
    id: String(match.ffbbMatchId), team: team.label, teamId: team.id, date,
    home: result.nomEquipe1 || (match.isHome ? clubName : match.opponent),
    away: result.nomEquipe2 || (match.isHome ? match.opponent : clubName),
    atHome: match.isHome, played,
    homeScore: played ? score(result.resultatEquipe1) : null,
    awayScore: played ? score(result.resultatEquipe2) : null,
    round: result.numeroJournee || null, url: team.source,
    location: match.location || null, competition: team.description, pouleId: team.pouleId,
  };
}

export async function importCalendar(api, config) {
  const path = `/api/v1/club/${config.club.id}`;
  const roster = await api.request(path + '/teams');
  const schedule = await api.request(path + '/matches');
  for (const response of [roster, schedule]) {
    if (String(response.organisme_id) !== String(config.club.id)) throw new Error('Club API incorrect.');
  }
  if (!Array.isArray(roster.teams) || !roster.teams.length || roster.count !== roster.teams.length ||
      !Array.isArray(schedule.matches) || !schedule.matches.length || schedule.count !== schedule.matches.length) throw new Error('Import API vide ou incomplet.');
  const teams = roster.teams.map(item => {
    if (!/^\d+$/.test(item.engagement_id) || !/^\d+$/.test(item.poule_id) || !item.competition) throw new Error('Engagement API invalide.');
    const custom = config.teamLabels[item.engagement_id];
    return { id: item.engagement_id, label: custom || item.competition, description: item.competition,
      category: /\bU\d+/i.test(item.competition) ? 'young' : 'senior',
      number: item.team_number, pouleId: item.poule_id,
      source: `${config.club.url}/equipes/${item.engagement_id}`, count: 0 };
  });
  if (new Set(teams.map(t => t.id)).size !== teams.length) throw new Error('Engagement API dupliqué.');
  const pools = new Map();
  for (const id of new Set(teams.map(team => team.pouleId))) {
    const pool = await api.request(`/api/v1/poule/${id}`);
    if (String(pool.id) !== id || !Array.isArray(pool.rencontres) || (pool.classements != null && !Array.isArray(pool.classements))) throw new Error(`Poule API invalide : ${id}`);
    pools.set(id, pool);
  }
  const ids = new Set();
  const matches = schedule.matches.map(match => {
    const candidates = teams.filter(team => team.pouleId === String(match.pouleId));
    const team = candidates.length === 1 ? candidates[0] : candidates.find(team => Number(team.number) === match.numeroEquipe);
    if (!team || ids.has(String(match.ffbbMatchId))) throw new Error('Rencontre sans équipe reconnue ou dupliquée.');
    ids.add(String(match.ffbbMatchId));
    const result = pools.get(team.pouleId).rencontres.find(item => String(item.id) === String(match.ffbbMatchId));
    team.count++;
    return normalizeMatch(match, result, team, roster.nom);
  });
  matches.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.team.localeCompare(b.team));
  const standings = [...pools.values()].map(pool => ({ id: String(pool.id), name: pool.nom, rows: pool.classements || [] }));
  return { updatedAt: new Date().toISOString(), source: config.club.url, sourceType: 'api', api: config.baseUrl, teams, matches, standings };
}
