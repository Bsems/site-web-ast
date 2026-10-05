// Affichage des partenaires à partir du JSON, avec instantané pour file://.
(() => {
  const grid = document.querySelector('[data-partners-grid]');
  const status = document.querySelector('[data-partners-status]');
  if (!grid || !status) return;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  let closeCurrent = null;

  function createCard(partner, index) {
    const card = element('article', 'partner-flip-card');
    const inner = element('div', 'partner-flip-inner');
    const front = element('button', 'partner-face partner-front');
    front.type = 'button';
    front.setAttribute('aria-label', 'Découvrir ' + partner.name);
    front.setAttribute('aria-expanded', 'false');
    const back = element('div', 'partner-face partner-back');
    back.id = 'partner-links-' + index;
    back.setAttribute('role', 'group');
    back.setAttribute('aria-label', 'Liens de ' + partner.name);
    front.setAttribute('aria-controls', back.id);
    back.inert = true;
    back.setAttribute('aria-hidden', 'true');

    const image = element('img', 'partner-logo');
    image.src = partner.image;
    image.alt = ''; // Le nom est déjà présent dans le bouton.
    image.loading = 'lazy';
    image.width = 240;
    image.height = 120;
    image.addEventListener('error', () => { image.hidden = true; });
    front.append(image, element('span', 'partner-name', partner.name),
      element('span', 'partner-hint', 'Découvrir les liens ↗'));
    back.append(element('h2', 'partner-back-title', partner.name));

    const links = element('div', 'partner-links');
    for (const link of partner.links) {
      if (link.enabled !== true) continue;
      let url;
      try { url = new URL(link.url); } catch { continue; }
      if (url.protocol !== 'https:') continue;
      const anchor = element('a', 'partner-link', link.label + ' ↗');
      anchor.href = url.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('aria-label', link.label + ' — ' + partner.name + ' (nouvel onglet)');
      links.append(anchor);
    }
    if (!links.childElementCount) {
      links.append(element('p', 'partner-empty', 'Les liens de ce partenaire seront bientôt disponibles.'));
    }
    const close = element('button', 'partner-return');
    close.type = 'button';
    close.setAttribute('aria-label', 'Revenir au logo de ' + partner.name);
    back.append(links, close);
    inner.append(front, back);
    card.append(inner);

    const setOpen = open => {
      card.classList.toggle('is-flipped', open);
      front.setAttribute('aria-expanded', String(open));
      front.inert = open;
      back.inert = !open;
      front.setAttribute('aria-hidden', String(open));
      back.setAttribute('aria-hidden', String(!open));
    };
    const closeCard = (restoreFocus = true) => {
      setOpen(false);
      if (closeCurrent === closeCard) closeCurrent = null;
      if (restoreFocus) front.focus({ preventScroll: true });
    };
    front.addEventListener('click', () => {
      if (closeCurrent) closeCurrent(false);
      setOpen(true);
      closeCurrent = closeCard;
      (links.querySelector('a') || close).focus({ preventScroll: true });
    });
    close.addEventListener('click', () => closeCard());
    card.addEventListener('keydown', event => {
      if (event.key === 'Escape' && card.classList.contains('is-flipped')) {
        event.stopPropagation();
        closeCard();
      }
    });
    return card;
  }

  async function loadPartners() {
    grid.setAttribute('aria-busy', 'true');
    try {
      let data;
      if (location.protocol === 'file:') {
        data = window.AST_PARTNERS;
      } else {
        const response = await fetch('data/partners.json');
        if (!response.ok) throw new Error('Chargement des partenaires impossible.');
        data = await response.json();
      }
      if (!Array.isArray(data?.partners) || !data.partners.length) throw new Error('Données manquantes.');
      const cards = data.partners.map(createCard);
      grid.replaceChildren(...cards);
      status.textContent = 'Sélectionnez un logo pour découvrir les liens du partenaire.';
    } catch (error) {
      status.replaceChildren(document.createTextNode('Les partenaires ne sont pas disponibles pour le moment. '));
      const retry = element('button', 'partner-retry', 'Réessayer');
      retry.type = 'button';
      retry.addEventListener('click', loadPartners);
      status.append(retry);
      console.error(error);
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }
  loadPartners();
})();
