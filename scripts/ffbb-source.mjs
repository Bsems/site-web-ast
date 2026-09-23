// Extraire les rencontres du flux React embarqué dans le HTML FFBB sans exécuter ses scripts.
export function readMatches(html) {
  // Assembler les fragments textuels du flux transmis par Next.js.
  const stream = [...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g)]
    .map(match => JSON.parse(match[1])[1]).filter(value => typeof value === 'string').join('');
  // Indexer les enregistrements JSON par identifiant pour résoudre leurs références.
  const records = new Map();
  for (const line of stream.split('\n')) {
    const match = line.match(/^([\da-f]+):(.*)$/);
    if (match) { try { records.set(match[1], JSON.parse(match[2])); } catch { /* Ignorer les enregistrements React qui ne sont pas du JSON. */ } }
  }
  // Suivre les références de type $identifiant:propriété vers les objets des équipes.
  function resolve(value) {
    if (typeof value !== 'string' || !/^\$[\da-f]+:/.test(value)) return value;
    const [id, ...path] = value.slice(1).split(':');
    let current = records.get(id);
    for (const key of path) current = resolve(current)?.[key];
    return current;
  }
  // Dédupliquer les rencontres par identifiant, même si plusieurs fragments les contiennent.
  const matches = new Map();
  // Parcourir les objets et tableaux pour reconnaître les rencontres et compléter leurs équipes.
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
