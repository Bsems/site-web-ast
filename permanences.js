(() => {
  function monthDays(year, month, events) {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const days = Array(offset).fill(null);
    for (let day = 1; day <= count; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, date, events: events.filter(event => event.date === date) });
    }
    while (days.length % 7) days.push(null);
    return days;
  }
  if (typeof module !== 'undefined') module.exports = { monthDays };
  if (typeof document === 'undefined') return;
  const calendar = document.getElementById('permanences-calendar');
  if (!calendar) return;
  const events = JSON.parse(document.getElementById('permanences-data').textContent);
  const title = document.getElementById('permanences-month');
  const body = document.getElementById('permanences-days');
  const details = document.getElementById('permanences-details');
  const today = new Date();
  let month = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
  const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  function render() {
    title.textContent = monthFormat.format(month);
    body.replaceChildren();
    details.replaceChildren();
    const days = monthDays(month.getFullYear(), month.getMonth(), events);
    let row;
    days.forEach((entry, index) => {
      if (index % 7 === 0) { row = document.createElement('tr'); body.append(row); }
      const cell = document.createElement('td');
      row.append(cell);
      if (!entry) return;
      const date = new Date(month.getFullYear(), month.getMonth(), entry.day);
      const day = document.createElement('span');
      day.className = 'permanences-day';
      day.textContent = entry.day;
      if (date.toDateString() === today.toDateString()) day.setAttribute('aria-current', 'date');
      if (entry.events.length) {
        day.classList.add('has-permanence');
        day.setAttribute('aria-label', `${dayFormat.format(date)} : permanence`);
        for (const event of entry.events) {
          const description = document.createElement('p');
          description.textContent = `${dayFormat.format(date)} · ${event.start.replace(':', ' h ')} – ${event.end.replace(':', ' h ')} · ${event.location}`;
          details.append(description);
        }
      }
      cell.append(day);
    });
    if (!details.childElementCount) {
      const empty = document.createElement('p');
      empty.textContent = 'Aucune permanence annoncée pour ce mois.';
      details.append(empty);
    }
  }
  calendar.querySelectorAll('[data-month-offset]').forEach(button => {
    button.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.monthOffset), 1);
      render();
    });
  });
  document.getElementById('permanences-today').addEventListener('click', () => {
    const now = new Date();
    month = new Date(now.getFullYear(), now.getMonth(), 1);
    render();
  });
  render();
  calendar.hidden = false;
})();
