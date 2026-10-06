/**
 * Export hors réseau de l'école de basket dans la zone SCHOOL du HTML.
 * Les rubriques [micro]/[mini] viennent du TXT ; horaires, équipes et images du JSON.
 * Les repères HTML et les noms des deux logos sont des dépendances du générateur.
 */
import { readFile, writeFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/ecole-de-basket-source.json', root), 'utf8'));
const source = await readFile(new URL('Texte/Ecole_de_basket_AST_source.txt', root), 'utf8');
// Lire chaque rubrique jusqu'au prochain en-tête entre crochets, puis ses paragraphes.
const sections = Object.fromEntries([...source.matchAll(/^\[([^\]]+)\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)].map(([, key, text]) => [key, text.trim().split(/\r?\n\s*\r?\n/)]));
if (!sections.micro?.length || !sections.mini?.length || !data.teams.length) throw new Error('Contenu de l’école de basket incomplet');
const e = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// Vérifier les pages locales et les images renseignées avant de composer le HTML.
for (const value of Object.values(data.links)) {
  if (!/^[a-z-]+\.html$/.test(value)) throw new Error(`Lien local invalide : ${value}`);
  await access(new URL(value, root));
}
for (const image of data.images.filter(image => image.src)) await access(new URL(image.src, root));
const image = (path, alt, css = '') => `<img class="${css}" src="${e(path)}" alt="${e(alt)}" loading="lazy" decoding="async" />`;
const asset = filename => {
  const result = data.images.find(item => item.src?.endsWith('/' + filename));
  if (!result) throw new Error(`Image manquante : ${filename}`);
  return result.src;
};
const micro = data.micro;
/* Modèle généré : introduction, micro-basket, mini-basket, équipes et inscription. */
const content = `
      <section class="school-intro section-padding" aria-labelledby="school-page-title">
        <a class="text-link" href="${e(data.links.teams)}">← Les équipes</a>
        <p class="eyebrow">Découvrir · Apprendre · S’épanouir</p>
        <h1 id="school-page-title">L’école<br /><em>de basket.</em></h1>
        <p class="school-lead">Les premiers dribbles, le plaisir de jouer ensemble.</p>
        <nav class="school-sections" aria-label="Les rubriques de l’école de basket"><a href="#micro-basket">Micro-basket</a><a href="#mini-basket">Mini-basket</a><a href="#school-teams">Nos équipes</a></nav>
      </section>
      <section id="micro-basket" class="school-section section-padding" aria-labelledby="micro-title">
        <div class="school-heading"><div><p class="eyebrow">De ${micro.ageMin} à ${micro.ageMax} ans</p><h2 id="micro-title">Le micro-<em>basket.</em></h2></div>${image(asset('micro_basket.png'), 'Logo Micro Basket', 'school-logo')}</div>
        <div class="school-micro-grid"><div><h3>Le Micro Basket, c’est :</h3><ul class="school-benefits">${sections.micro.map(text => `<li>${e(text)}</li>`).join('')}</ul></div>
          <aside class="school-practical" aria-labelledby="school-practical-title"><h3 id="school-practical-title">Pour les premiers pas</h3><p><strong>${micro.durationHours} h le ${e(micro.day)}</strong><br />Au ${e(micro.location)}</p><p>${micro.trialSessions} séances d’essai avant de valider la licence.${micro.parentRequired ? ' Présence d’un parent durant la séance.' : ''}</p><a href="${e(data.links.gym)}">Voir les gymnases →</a><p>Inscriptions :<br /><a href="mailto:${e(micro.email)}">${e(micro.email)}</a></p></aside></div>
      </section>
      <section id="mini-basket" class="school-section school-mini section-padding" aria-labelledby="mini-title">
        <div class="school-heading"><div><p class="eyebrow">Le plaisir du jeu</p><h2 id="mini-title">Le mini-<em>basket.</em></h2></div>${image(asset('LogoMiniBasket-FFBB.officiel.png'), 'Logo MiniBasket FFBB', 'school-logo')}</div>
        ${sections.mini.map(text => `<p>${e(text)}</p>`).join('')}
        <p>Près de ${new Intl.NumberFormat('fr-FR').format(data.mini.membersApprox)} licenciés pratiquent le MiniBasket.</p>
        <ul class="school-ages">${data.mini.categories.map(category => `<li><strong>${e(category.name)}</strong>${category.ages ? `<span>${category.ages.join(' et ')} ans</span>` : ''}${category.formerName ? `<small>Anciennement ${e(category.formerName)}</small>` : ''}</li>`).join('')}</ul>
      </section>
      <section id="school-teams" class="school-section section-padding" aria-labelledby="school-teams-title"><p class="eyebrow">Grandir ensemble</p><h2 id="school-teams-title">Nos <em>équipes.</em></h2>
        <div class="school-team-grid">${data.teams.map(team => `<article class="school-team">${image(team.image, `${team.name} de l’AST Basket — photo publiée par le club`, 'school-team-photo')}<div class="school-team-copy"><h3>${e(team.name)}</h3><p><strong>${e(team.coach)}</strong><br />${e(team.role)}</p></div></article>`).join('')}</div>
      </section>
      <section class="school-join section-padding" aria-labelledby="school-join-title"><h2 id="school-join-title">À vous <em>de jouer.</em></h2><p>Envie de rejoindre l’école de basket ?</p><a class="button button-light" href="${e(data.links.registration)}">Les inscriptions <span aria-hidden="true">→</span></a></section>`;
const file = new URL('ecole-de-basket.html', root);
const page = await readFile(file, 'utf8');
// Le reste du document demeure éditable à la main ; ne pas renommer ces repères.
const marker = /<!-- SCHOOL:START -->[\s\S]*?<!-- SCHOOL:END -->/;
if (!marker.test(page)) throw new Error('Emplacement de l’école de basket manquant');
await writeFile(file, page.replace(marker, () => `<!-- SCHOOL:START -->${content}\n<!-- SCHOOL:END -->`));
console.log('Page École de basket générée depuis les sources TXT et JSON.');
