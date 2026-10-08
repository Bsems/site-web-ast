/**
 * Calendrier public : aucune requête FFBB depuis le navigateur.
 * Entrées : window.AST_CALENDAR, puis data/calendar.json sur HTTP(S).
 * Sortie : DOM de #weekly-calendar ; le JSON reste la source de référence.
 * Les fonctions calendaires sont exportées sous Node pour les tests hors réseau.
 */
// Isoler les variables du calendrier pour éviter les collisions avec les autres scripts.
(async function () {
  'use strict';
  // Durée d’un jour en millisecondes ; les calculs calendaires utilisent UTC.
  const DAY = 86400000;
  // Décaler une date ISO de plusieurs jours, sans dépendre des changements d’heure locaux.
  function shift(date, days) {
    return new Date(Date.parse(date + 'T12:00:00Z') + days * DAY).toISOString().slice(0, 10);
  }
  // Ramener chaque date au lundi de sa semaine (dimanche vaut 0 en JavaScript).
  function monday(date) {
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    return shift(date, -((day + 6) % 7));
  }
  // Regrouper les rencontres datées par lundi, puis trier par horaire et équipe.
  function groupWeeks(matches) {
    const groups = new Map();
    for (const match of matches) {
      if (!match.date) continue;
      const week = monday(match.date.slice(0, 10));
      if (!groups.has(week)) groups.set(week, []);
      groups.get(week).push(match);
    }
    for (const list of groups.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.team.localeCompare(b.team));
    return groups;
  }
  // Afficher un score uniquement pour un match joué ; conserver les véritables scores nuls.
  function result(match, today) {
    if (match.played && Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore)) return `${match.homeScore} – ${match.awayScore}`;
    if (!match.played && match.date?.slice(0, 10) === today) return 'Aujourd’hui';
    return match.date && match.date.slice(0, 10) > today ? 'À venir' : 'Score indisponible';
  }
  /*
   * Issue du match vue par l'AST : win, loss, draw, today, upcoming ou unknown.
   * atHome fait foi : le nom de l'équipe n'est jamais utilisé pour la comparaison.
   */
  function outcome(match, today) {
    if (match.played && Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore) && typeof match.atHome === 'boolean') {
      const ast = match.atHome ? match.homeScore : match.awayScore;
      const opponent = match.atHome ? match.awayScore : match.homeScore;
      return ast > opponent ? 'win' : ast < opponent ? 'loss' : 'draw';
    }
    const day = match.date?.slice(0, 10);
    if (!match.played && day === today) return 'today';
    return day && day > today ? 'upcoming' : 'unknown';
  }
  // Initiales d'un club pour remplacer un logo absent : « IE - BASKET CLUB LOURDAIS - 2 » donne « BL ».
  const STOP_WORDS = new Set(['IE', 'CTC', 'BASKET', 'BASKETBALL', 'BB', 'CLUB', 'BC', 'DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'ET', 'SUR', 'EN']);
  function initials(name) {
    const words = String(name || '').toUpperCase().replace(/\s-\s\d+$/, '').split(/[^A-ZÀ-Ÿ0-9]+/).filter(Boolean);
    const kept = words.filter(word => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
    return (kept.length ? kept : words).slice(0, 2).map(word => word[0]).join('') || '?';
  }
  // URL réduite du logo FFBB ; seul un UUID est accepté pour ne jamais construire d'autre adresse.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function logoUrl(id) {
    return typeof id === 'string' && UUID.test(id) ? `https://api.ffbb.app/assets/${id}?width=128&height=128&fit=inside&format=webp` : null;
  }
  // Exposer les fonctions aux tests Node ; arrêter ensuite si aucun navigateur n’est présent.
  if (typeof module !== 'undefined') module.exports = { shift, monday, groupWeeks, result, outcome, initials, logoUrl };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#weekly-calendar');
  if (!root) return;
  // Lire l’instantané local chargé par la page avant ce script.
  let data = window.AST_CALENDAR;
  /*
   * Sur le web, préférer le JSON frais avec un délai maximal de dix secondes.
   * En cas d'échec, garder la copie JS déjà chargée ; en file://, éviter fetch.
   * L'avertissement de fraîcheur indique l'âge de l'import, pas celui des scores FFBB.
   */
  if (location.protocol !== 'file:') {
    try {
      const response = await fetch('data/calendar.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Chargement impossible');
      const fresh = await response.json();
      if (!Array.isArray(fresh.matches) || !fresh.updatedAt) throw new Error('Données invalides');
      data = fresh;
    } catch { /* Conserver la dernière copie locale disponible. */ }
  }
  if (!data || !Array.isArray(data.matches)) {
    root.textContent = 'Le calendrier est indisponible. Consultez les rencontres sur la FFBB via le lien ci-dessous.';
    return;
  }
  // Déterminer la semaine courante selon la date en France métropolitaine.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const currentWeek = monday(today);
  const groups = groupWeeks(data.matches);
  // Inclure toutes les semaines entre les matchs et la semaine courante, même sans rencontre.
  const boundaries = [...groups.keys(), currentWeek].sort();
  const weeks = [];
  for (let date = boundaries[0]; date <= boundaries.at(-1); date = shift(date, 7)) weeks.push(date);
  let selected = weeks.indexOf(currentWeek);
  const format = (date, options) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(new Date(date + 'T12:00:00Z'));
  const weekLabel = week => `Du ${format(week, { day: 'numeric', month: 'long' })} au ${format(shift(week, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`;
  // Créer les éléments avec textContent : les données sont du texte, jamais du HTML exécuté.
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  // Construire les commandes accessibles de sélection de la semaine.
  const controls = node('div', 'calendar-controls');
  const previous = node('button', 'calendar-arrow', '←');
  previous.type = 'button'; previous.setAttribute('aria-label', 'Semaine précédente');
  const next = node('button', 'calendar-arrow', '→');
  next.type = 'button'; next.setAttribute('aria-label', 'Semaine suivante');
  const label = node('label', 'calendar-select-label', 'Choisir une semaine');
  const select = node('select'); select.id = 'calendar-week'; label.htmlFor = select.id;
  for (const [index, week] of weeks.entries()) {
    const count = (groups.get(week) || []).length;
    const option = node('option', '', `${weekLabel(week)} · ${count} match${count > 1 ? 's' : ''}`);
    option.value = String(index); select.append(option);
  }
  const chooser = node('div', 'calendar-chooser'); chooser.append(label, select);
  const current = node('button', 'calendar-today', 'Cette semaine'); current.type = 'button';
  controls.append(previous, chooser, next, current);
  // Préparer le titre, le statut annoncé et le conteneur des rencontres.
  const heading = node('h2', 'calendar-week-title'); heading.id = 'calendar-week-title';
  const summary = node('p', 'calendar-summary'); summary.setAttribute('role', 'status');
  const record = node('div', 'calendar-tally');
  const list = node('div', 'calendar-days'); list.setAttribute('aria-labelledby', heading.id);
  const updated = node('p', 'calendar-updated', 'Données FFBB mises à jour le ' + new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.updatedAt)) + '.');
  if (Date.now() - Date.parse(data.updatedAt) > 48 * 60 * 60 * 1000) updated.append(' Des résultats récents peuvent manquer : la dernière actualisation date de plus de deux jours.');
  root.replaceChildren(controls, heading, summary, record, list, updated);
  // Libellés des badges d'issue ; les résultats restent sans emoji, les autres en ont un décoratif.
  const BADGES = {
    win: ['', 'Victoire'], loss: ['', 'Défaite'], draw: ['', 'Match nul'],
    today: ['⏱️', 'Aujourd’hui'], upcoming: ['📅', 'À venir'], unknown: ['❔', 'Score indisponible'],
  };
  // Écusson d'un club : logo FFBB réduit, ou initiales colorées si le logo manque ou échoue.
  function crest(name, logo) {
    const box = node('span', 'fixture-crest');
    const fallback = () => {
      const letters = node('span', 'fixture-initials', initials(name));
      let hash = 0;
      for (const char of String(name)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
      letters.style.setProperty('--hue', String(hash));
      box.replaceChildren(letters);
    };
    const url = logoUrl(logo);
    if (!url) { fallback(); return box; }
    const image = node('img');
    image.src = url; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
    image.width = 64; image.height = 64;
    image.addEventListener('error', fallback, { once: true });
    box.append(image);
    return box;
  }
  // Une équipe du tableau d'affichage : écusson puis nom, l'AST étant mise en avant.
  function side(name, logo, isAst) {
    const element = node('div', isAst ? 'fixture-side is-ast' : 'fixture-side');
    element.append(crest(name, logo), node('p', 'fixture-name', name));
    return element;
  }
  // Construire une fiche : badge d'issue, équipe AST, horaire, tableau d'affichage et lien source.
  function matchCard(match, index = 0) {
    const issue = outcome(match, today);
    const card = node('article', `fixture fixture--${issue}`);
    card.style.setProperty('--i', String(index));
    const meta = node('div', 'fixture-meta');
    const [emoji, text] = BADGES[issue];
    const badge = node('span', 'fixture-badge', text);
    if (emoji) {
      const icon = node('span', '', emoji + ' ');
      icon.setAttribute('aria-hidden', 'true');
      badge.prepend(icon);
    }
    meta.append(badge, node('span', 'fixture-team', match.team), node('span', '', match.atHome ? 'À domicile' : 'À l’extérieur'));
    const time = node('time', '', match.date ? match.date.slice(11, 16).replace(':', 'h') : 'Horaire à confirmer');
    if (match.date) time.dateTime = match.date;
    meta.append(time);
    const board = node('div', 'fixture-board');
    const score = node('p', 'fixture-score');
    /*
     * Conserver l'ordre domicile/extérieur ; seul le vainqueur garde son chiffre
     * en pleine intensité. Les matchs non joués affichent le texte de result().
     */
    if (['win', 'loss', 'draw'].includes(issue)) {
      const digit = (value, other) => node('span', value > other ? 'fixture-digit is-winner' : 'fixture-digit', String(value));
      score.append(digit(match.homeScore, match.awayScore), node('span', 'fixture-dash', '–'), digit(match.awayScore, match.homeScore));
      score.setAttribute('aria-label', `Score ${match.homeScore} à ${match.awayScore}`);
    } else {
      score.classList.add('is-pending');
      score.textContent = issue === 'today' || issue === 'upcoming' ? 'VS' : result(match, today);
    }
    board.append(side(match.home, match.homeLogo, match.atHome === true), score, side(match.away, match.awayLogo, match.atHome === false));
    const footer = node('div', 'fixture-footer');
    if (match.location) footer.append(node('p', 'fixture-location', `📍 ${match.location}`));
    const detail = node('a', 'fixture-link', 'Rencontres sur la FFBB ↗');
    detail.href = match.url; detail.target = '_blank'; detail.rel = 'noopener noreferrer';
    detail.setAttribute('aria-label', `${match.team} : rencontres FFBB (nouvel onglet)`);
    footer.append(detail);
    card.append(meta, board, footer);
    return card;
  }
  // Bilan de la semaine affiché en pastilles : victoires, défaites, nuls et matchs à venir.
  function tally(matches) {
    const counts = { win: 0, loss: 0, draw: 0, upcoming: 0 };
    for (const match of matches) {
      const issue = outcome(match, today);
      if (issue === 'today') counts.upcoming++;
      else if (issue in counts) counts[issue]++;
    }
    const chips = [
      ['win', counts.win, counts.win > 1 ? 'victoires' : 'victoire'],
      ['loss', counts.loss, counts.loss > 1 ? 'défaites' : 'défaite'],
      ['draw', counts.draw, counts.draw > 1 ? 'nuls' : 'nul'],
      ['upcoming', counts.upcoming, 'à venir'],
    ].filter(([, count]) => count > 0);
    return chips.map(([issue, count, label]) => {
      const chip = node('span', `calendar-chip calendar-chip--${issue}`);
      chip.append(node('strong', '', String(count)), ` ${label}`);
      return chip;
    });
  }
  // Actualiser la semaine sélectionnée, les limites des boutons et les rencontres par jour.
  function render() {
    const week = weeks[selected];
    select.value = String(selected); previous.disabled = selected === 0; next.disabled = selected === weeks.length - 1;
    heading.textContent = weekLabel(week);
    const matches = groups.get(week) || [];
    summary.textContent = `${matches.length} rencontre${matches.length > 1 ? 's' : ''} · Toutes les équipes · Horaires de France métropolitaine`;
    record.replaceChildren(...tally(matches));
    list.replaceChildren();
    if (!matches.length) list.append(node('p', 'calendar-empty', 'Aucune rencontre publiée pour cette semaine. 🏖️'));
    let day;
    let dayList;
    for (const [index, match] of matches.entries()) {
      const date = match.date.slice(0, 10);
      if (date !== day) {
        day = date;
        const section = node('section', 'calendar-day');
        section.append(node('h3', '', format(day, { weekday: 'long', day: 'numeric', month: 'long' })));
        dayList = node('div', 'fixture-list'); section.append(dayList); list.append(section);
      }
      dayList.append(matchCard(match, index));
    }
  }
  // Chaque commande modifie l’index sélectionné puis reconstruit la liste visible.
  previous.addEventListener('click', () => { if (selected > 0) { selected--; render(); } });
  next.addEventListener('click', () => { if (selected < weeks.length - 1) { selected++; render(); } });
  current.addEventListener('click', () => { selected = weeks.indexOf(currentWeek); render(); });
  select.addEventListener('change', () => { selected = Number(select.value); render(); });
  render();
  // Présenter séparément les rencontres sans date, exclues du regroupement hebdomadaire.
  const undated = data.matches.filter(match => !match.date);
  if (undated.length) {
    const pending = node('section', 'calendar-pending');
    pending.append(node('h2', 'calendar-week-title', 'Dates à confirmer'));
    undated.forEach(match => pending.append(matchCard(match)));
    root.append(pending);
  }
})();
