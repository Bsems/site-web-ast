/**
 * Export éditorial hors réseau vers la zone BASKET-SANTE de basket-sante.html.
 * Texte : Texte/Basket_sante_AST_source.txt ; liens, séances et médias : JSON.
 * L'ordre des paragraphes TXT et des images est significatif : les indices du
 * modèle doivent être revus si la structure des sources change.
 */
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/basket-sante-source.json', root), 'utf8'));
const text = (await readFile(new URL('Texte/Basket_sante_AST_source.txt', root), 'utf8')).trim().split(/\r?\n\s*\r?\n/);
// Échapper le contenu injecté ; cela ne valide pas le protocole des URL du JSON.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const p = i => `<p>${escape(text[i])}</p>`;
const img = (i) => { const x = data.images[i]; return `<a href="${escape(x.src)}"><img src="${escape(x.src)}" alt="${escape(x.alt)}" width="${x.width}" height="${x.height}" loading="lazy" /></a>`; };
const schedule = data.schedule;
/* Modèle de la zone générée : présentation, objectifs, vidéos et flyer. */
const content = `
      <section class="health-intro section-padding" aria-labelledby="health-title">
        <p class="eyebrow">AST Basket · Une pratique adaptée</p>
        <h1 id="health-title">Basket <em>Santé.</em></h1>
        <div class="health-intro-grid"><div class="health-lead">${p(2)}</div>
          <aside class="health-session" aria-label="Informations pratiques"><h2>Les séances</h2><p><strong>${escape(schedule.day)} de ${escape(schedule.start)} à ${escape(schedule.end)}</strong></p><p>${escape(schedule.location)}</p><a href="${escape(schedule.url)}">Voir le gymnase →</a><a class="health-contact" href="mailto:${escape(data.contactEmail)}">${escape(data.contactEmail)}</a></aside></div>
      </section>
      <section class="health-section section-padding" aria-labelledby="health-presentation"><p class="eyebrow">Présentation</p><h2 id="health-presentation">Une activité pour <em>chacun.</em></h2>${p(3)}<div class="health-labels"><h3>${escape(text[0])}</h3>${p(1)}</div><figure>${img(1)}</figure></section>
      <section class="health-section health-objectives section-padding" aria-labelledby="health-objectives"><p class="eyebrow">Les objectifs</p><h2 id="health-objectives">Bouger et se sentir <em>bien.</em></h2><h3>${escape(text[4])}</h3><ul>${[5,6,7].map(i => `<li>${escape(text[i].replace(/^–\s*/, ''))}</li>`).join('')}</ul>${p(8)}${p(9)}${p(10)}</section>
      <section class="health-section section-padding" aria-labelledby="health-videos"><h2 id="health-videos">Le Basket Santé <em>en vidéo.</em></h2><p>${escape(text[11])}</p><div class="health-videos">${data.videos.map((v,i) => `<a href="${escape(v.url)}" target="_blank" rel="noopener noreferrer">${escape(text[12+i])}<span aria-hidden="true"> ↗</span><span class="sr-only"> (nouvel onglet)</span></a>`).join('')}</div></section>
      <section class="health-section health-flyer section-padding" aria-labelledby="health-flyer"><h2 id="health-flyer">Rejoignez <em>les séances.</em></h2><figure>${img(0)}<figcaption>Cliquez sur le flyer pour l’ouvrir en grand.</figcaption></figure>${p(14)}${p(15)}<a class="button button-light" href="mailto:${escape(data.contactEmail)}">Nous contacter →</a></section>`;
const path = new URL('basket-sante.html', root);
let page = await readFile(path, 'utf8');
// Remplacer uniquement entre ces repères ; conserver navigation et pied de page.
const marker = /<!-- BASKET-SANTE:START -->[\s\S]*?<!-- BASKET-SANTE:END -->/;
if (!marker.test(page)) throw new Error('Emplacement Basket Santé manquant');
page = page.replace(marker, () => `<!-- BASKET-SANTE:START -->${content}\n<!-- BASKET-SANTE:END -->`);
await writeFile(path, page);
console.log('Page Basket Santé générée depuis les sources TXT et JSON.');
