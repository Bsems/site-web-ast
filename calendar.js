(function () {
  'use strict';
  const DAY = 86400000;
  function shift(date, days) {
    return new Date(Date.parse(date + 'T12:00:00Z') + days * DAY).toISOString().slice(0, 10);
  }
  function monday(date) {
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    return shift(date, -((day + 6) % 7));
  }
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
  function result(match, today) {
    if (match.played && match.homeScore !== null && match.awayScore !== null) return `${match.homeScore} – ${match.awayScore}`;
    if (!match.played && match.date?.slice(0, 10) === today) return 'Aujourd’hui';
    return match.date && match.date.slice(0, 10) > today ? 'À venir' : 'Score non publié';
  }
  if (typeof module !== 'undefined') module.exports = { shift, monday, groupWeeks, result };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#weekly-calendar');
  if (!root) return;
  const data = window.AST_CALENDAR;
  if (!data || !Array.isArray(data.matches)) {
    root.textContent = 'Le calendrier est indisponible. Consultez les rencontres sur la FFBB via le lien ci-dessous.';
    return;
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const currentWeek = monday(today);
  const groups = groupWeeks(data.matches);
  const boundaries = [...groups.keys(), currentWeek].sort();
  const weeks = [];
  for (let date = boundaries[0]; date <= boundaries.at(-1); date = shift(date, 7)) weeks.push(date);
  let selected = weeks.indexOf(currentWeek);
  const format = (date, options) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(new Date(date + 'T12:00:00Z'));
  const weekLabel = week => `Du ${format(week, { day: 'numeric', month: 'long' })} au ${format(shift(week, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
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
  const heading = node('h2', 'calendar-week-title'); heading.id = 'calendar-week-title';
  const summary = node('p', 'calendar-summary'); summary.setAttribute('role', 'status');
  const list = node('div', 'calendar-days'); list.setAttribute('aria-labelledby', heading.id);
  const updated = node('p', 'calendar-updated', 'Données FFBB mises à jour le ' + new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.updatedAt)) + '.');
  root.replaceChildren(controls, heading, summary, list, updated);
  function matchCard(match) {
    const card = node('article', 'fixture');
    const meta = node('div', 'fixture-meta');
    meta.append(node('span', 'fixture-team', match.team), node('span', '', match.atHome ? 'À domicile' : 'À l’extérieur'));
    const time = node('time', '', match.date ? match.date.slice(11, 16).replace(':', 'h') : 'Horaire à confirmer');
    if (match.date) time.dateTime = match.date;
    meta.append(time);
    const versus = node('div', 'fixture-versus');
    versus.append(node('p', match.atHome ? 'fixture-ast' : '', match.home), node('p', 'fixture-score', result(match, today)), node('p', match.atHome ? '' : 'fixture-ast', match.away));
    const detail = node('a', 'fixture-link', 'Fiche du match ↗');
    detail.href = match.url; detail.target = '_blank'; detail.rel = 'noopener noreferrer';
    detail.setAttribute('aria-label', `${match.team} : ${match.home} contre ${match.away}, fiche FFBB (nouvel onglet)`);
    card.append(meta, versus, detail);
    return card;
  }
  function render() {
    const week = weeks[selected];
    select.value = String(selected); previous.disabled = selected === 0; next.disabled = selected === weeks.length - 1;
    heading.textContent = weekLabel(week);
    const matches = groups.get(week) || [];
    summary.textContent = `${matches.length} rencontre${matches.length > 1 ? 's' : ''} · Toutes les équipes · Horaires de France métropolitaine`;
    list.replaceChildren();
    if (!matches.length) list.append(node('p', 'calendar-empty', 'Aucune rencontre publiée pour cette semaine.'));
    let day;
    let dayList;
    for (const match of matches) {
      const date = match.date.slice(0, 10);
      if (date !== day) {
        day = date;
        const section = node('section', 'calendar-day');
        section.append(node('h3', '', format(day, { weekday: 'long', day: 'numeric', month: 'long' })));
        dayList = node('div', 'fixture-list'); section.append(dayList); list.append(section);
      }
      dayList.append(matchCard(match));
    }
  }
  previous.addEventListener('click', () => { if (selected > 0) { selected--; render(); } });
  next.addEventListener('click', () => { if (selected < weeks.length - 1) { selected++; render(); } });
  current.addEventListener('click', () => { selected = weeks.indexOf(currentWeek); render(); });
  select.addEventListener('change', () => { selected = Number(select.value); render(); });
  render();
  const undated = data.matches.filter(match => !match.date);
  if (undated.length) {
    const pending = node('section', 'calendar-pending');
    pending.append(node('h2', 'calendar-week-title', 'Dates à confirmer'));
    undated.forEach(match => pending.append(matchCard(match)));
    root.append(pending);
  }
})();
