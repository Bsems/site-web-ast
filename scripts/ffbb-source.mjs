export function readMatches(html) {
  const stream = [...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g)]
    .map(match => JSON.parse(match[1])[1]).filter(value => typeof value === 'string').join('');
  const records = new Map();
  for (const line of stream.split('\n')) {
    const match = line.match(/^([\da-f]+):(.*)$/);
    if (match) { try { records.set(match[1], JSON.parse(match[2])); } catch { /* Non-JSON React records. */ } }
  }
  function resolve(value) {
    if (typeof value !== 'string' || !/^\$[\da-f]+:/.test(value)) return value;
    const [id, ...path] = value.slice(1).split(':');
    let current = records.get(id);
    for (const key of path) current = resolve(current)?.[key];
    return current;
  }
  const matches = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if ('date_rencontre' in value && value.idEngagementEquipe1) {
      matches.set(value.id, { ...value,
        idEngagementEquipe1: resolve(value.idEngagementEquipe1),
        idEngagementEquipe2: resolve(value.idEngagementEquipe2) });
    }
    Object.values(value).forEach(visit);
  }
  records.forEach(visit);
  return [...matches.values()];
}
