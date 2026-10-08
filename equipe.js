/**
 * Page d'une équipe : equipe.html?equipe=<slug> (slug de displayTeams).
 * Entrées : window.AST_TEAMS (equipes-data.js), calendrier via ASTFixtures.loadCalendar
 * (calendar.js, chargé avant). Sortie : DOM de #team-content.
 * Les sections sans contenu (photo, staff, effectif) ne sont pas affichées.
 */
(async function () {
  'use strict';
  const root = document.querySelector('#team-content');
  const fixtures = window.ASTFixtures;
  if (!root || !fixtures) return;
  const { node, crest, matchCard, outcome, loadCalendar, parisToday } = fixtures;
  const title = document.querySelector('#team-title');
  const category = document.querySelector('#team-category');
  const competition = document.querySelector('#team-competition');

  // Retrouver l'équipe demandée ; un slug inconnu renvoie vers la liste des équipes.
  const slug = new URLSearchParams(location.search).get('equipe');
  const team = (window.AST_TEAMS || []).find(item => item.slug === slug);
  if (!team) {
    title.textContent = 'Équipe introuvable';
    const back = node('a', 'text-link', 'Voir toutes les équipes');
    back.href = 'equipes.html';
    const message = node('p', 'calendar-empty', 'Cette équipe n’existe pas ou plus. ');
    message.append(back);
    root.replaceChildren(message);
    return;
  }
  document.title = `AST Basket | ${team.name}`;
  title.textContent = team.name;
  category.textContent = team.category === 'young' ? 'Jeunes' : 'Séniors';

  const data = await loadCalendar();
  const today = parisToday();
  const engagement = data?.teams.find(item => item.id === team.engagementId);
  const standing = engagement?.pouleId ? data.standings?.find(item => item.id === engagement.pouleId) : null;
  const matches = (data?.matches || []).filter(match => team.engagementId && match.teamId === team.engagementId);
  competition.textContent = [engagement?.description, standing?.name].filter(Boolean).join(' · ');

  // Une section titrée ; l'identifiant relie le titre pour les lecteurs d'écran.
  function section(id, heading) {
    const element = node('section', 'team-section');
    element.setAttribute('aria-labelledby', id);
    const h2 = node('h2', 'team-section-title', heading); h2.id = id;
    element.append(h2);
    return element;
  }

  // Chiffres clés : position, bilan, points et différence, d'après le classement.
  function keyFigures() {
    const ast = standing?.rows.find(row => row.isAst === true);
    const played = matches.map(match => outcome(match, today));
    const won = ast ? ast.won : played.filter(issue => issue === 'win').length;
    const lost = ast ? ast.lost : played.filter(issue => issue === 'loss').length;
    const figures = [];
    if (ast) figures.push(['Classement', `${ast.position}${ast.position === 1 ? 'er' : 'e'}`, `sur ${standing.rows.length}`]);
    figures.push(['Victoires', String(won), won > 1 ? 'matchs gagnés' : 'match gagné']);
    figures.push(['Défaites', String(lost), lost > 1 ? 'matchs perdus' : 'match perdu']);
    if (ast) figures.push(['Points', String(ast.points), `diff. ${ast.difference > 0 ? '+' : ''}${ast.difference}`]);
    const list = node('div', 'team-figures');
    for (const [label, value, detail] of figures) {
      const item = node('div', 'team-figure');
      item.append(node('span', 'team-figure-label', label), node('strong', 'team-figure-value', value), node('span', 'team-figure-detail', detail));
      list.append(item);
    }
    return list;
  }

  // Photo d'équipe, staff et effectif : contenu de equipes.json, affiché seulement s'il existe.
  function photoSection() {
    const element = section('team-photo-title', 'Photo d’équipe');
    const image = node('img', 'team-photo');
    image.src = team.photo; image.alt = `Photo de l’équipe ${team.name}`; image.loading = 'lazy';
    element.append(image);
    return element;
  }
  function peopleSection(id, heading, people, describe) {
    const element = section(id, heading);
    const grid = node('ul', 'team-people');
    for (const person of people) {
      const card = node('li', 'team-person');
      const portrait = node('div', 'team-person-photo');
      if (person.photo) {
        const image = node('img'); image.src = person.photo; image.alt = ''; image.loading = 'lazy';
        portrait.append(image);
      } else {
        portrait.append(crest(person.name, null));
      }
      card.append(portrait, node('p', 'team-person-name', person.name));
      const detail = describe(person);
      if (detail) card.append(node('p', 'team-person-detail', detail));
      grid.append(card);
    }
    element.append(grid);
    return element;
  }

  // Classement complet de la poule ; la ligne AST est mise en avant.
  function standingSection() {
    const element = section('team-standing-title', 'Classement');
    // Un instantané antérieur aux classements nommés (sans isAst) est traité comme indisponible.
    if (!standing?.available || !standing.rows.length || !standing.rows.every(row => typeof row.isAst === 'boolean')) {
      element.append(node('p', 'calendar-empty', 'Classement indisponible pour le moment.'));
      return element;
    }
    const withDraws = standing.rows.some(row => row.draws > 0);
    const columns = [['Pts', 'Points', 'points'], ['J', 'Matchs joués', 'played'], ['G', 'Gagnés', 'won'], ['P', 'Perdus', 'lost'],
      ...(withDraws ? [['N', 'Nuls', 'draws']] : []), ['+', 'Points marqués', 'scored'], ['−', 'Points encaissés', 'conceded'], ['Diff', 'Différence', 'difference']];
    const wrapper = node('div', 'standing-scroll');
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Tableau de classement, défilable horizontalement');
    const table = node('table', 'standing-table');
    table.append(node('caption', '', standing.name ? `${engagement.description || 'Classement'} · ${standing.name}` : 'Classement'));
    const head = node('tr');
    head.append(node('th', 'standing-pos', '#'), node('th', 'standing-team', 'Équipe'));
    for (const [short, long, key] of columns) {
      const th = node('th', `standing-num standing-${key}`);
      const abbr = node('abbr', '', short); abbr.title = long;
      th.append(abbr); th.scope = 'col'; head.append(th);
    }
    head.querySelectorAll('th').forEach(th => { th.scope = 'col'; });
    const thead = node('thead'); thead.append(head);
    const tbody = node('tbody');
    for (const row of standing.rows) {
      const tr = node('tr', row.isAst ? 'is-ast' : '');
      const name = node('th', 'standing-team');
      name.scope = 'row';
      const label = node('span', 'standing-team-label');
      label.append(crest(row.team || 'Équipe', row.logo), node('span', '', row.team || 'Équipe inconnue'));
      name.append(label);
      tr.append(node('td', 'standing-pos', String(row.position)), name);
      for (const [, , key] of columns) {
        const value = row[key];
        tr.append(node('td', `standing-num standing-${key}`, key === 'difference' && value > 0 ? `+${value}` : String(value)));
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    wrapper.append(table);
    element.append(wrapper);
    return element;
  }

  // Matchs de l'équipe : prochains rendez-vous dans l'ordre, résultats du plus récent au plus ancien.
  function matchesSection(id, heading, list, empty) {
    const element = section(id, heading);
    if (!list.length) {
      element.append(node('p', 'calendar-empty', empty));
      return element;
    }
    const grid = node('div', 'fixture-list');
    list.forEach((match, index) => {
      const day = node('p', 'team-match-date', match.date
        ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(match.date.slice(0, 10) + 'T12:00:00Z'))
        : 'Date à confirmer');
      grid.append(day, matchCard(match, today, index));
    });
    element.append(grid);
    return element;
  }

  const sections = [keyFigures()];
  if (!data) sections.push(node('p', 'calendar-empty', 'Les données FFBB sont indisponibles pour le moment.'));
  if (team.photo) sections.push(photoSection());
  if (team.staff.length) sections.push(peopleSection('team-staff-title', 'Le staff', team.staff, person => person.role));
  if (team.roster.length) {
    sections.push(peopleSection('team-roster-title', 'L’effectif', team.roster,
      player => [player.number && `n° ${player.number}`, player.position, player.height].filter(Boolean).join(' · ')));
  }
  // Les trois prochains rendez-vous suffisent ; le calendrier complet reste sur calendrier.html.
  const upcoming = matches.filter(match => ['today', 'upcoming'].includes(outcome(match, today))).slice(0, 3);
  const results = matches.filter(match => ['win', 'loss', 'draw', 'unknown'].includes(outcome(match, today))).reverse();
  sections.push(
    matchesSection('team-next-title', 'Prochains matchs', upcoming, 'Aucun match à venir publié pour le moment.'),
    standingSection(),
    matchesSection('team-results-title', 'Résultats', results, 'Aucun résultat pour le moment.'),
  );
  if (team.source) {
    const link = node('a', 'text-link team-source', 'Voir l’équipe sur la FFBB ↗');
    link.href = team.source; link.target = '_blank'; link.rel = 'noopener noreferrer';
    sections.push(link);
  }
  if (data?.updatedAt) {
    sections.push(node('p', 'calendar-updated', 'Données FFBB mises à jour le ' + new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.updatedAt)) + '.'));
  }
  root.replaceChildren(...sections);
})();
