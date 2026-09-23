// Navigation commune à toutes les pages : bouton mobile et liste des liens.
const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-navigation');

// Synchronise l’état visuel, les sous-menus et le libellé annoncé aux lecteurs d’écran.
function setMenu(open) {
  navigation.classList.toggle('is-open', open);
  if (!open) navigation.querySelectorAll('details[open]').forEach(dropdown => { dropdown.open = false; });
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.sr-only').textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
}

// Installer les interactions uniquement si les deux éléments du menu existent.
if (toggle && navigation) {
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  // Refermer le menu après le choix d’une destination.
  navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  // Échap ferme le menu et rend le focus au bouton qui permet de le rouvrir.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
}

// Chaque sous-menu se ferme avec Échap ou lors d’un clic extérieur.
document.querySelectorAll('.club-dropdown').forEach(dropdown => {
  dropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dropdown.open) {
      // éviter que le même Échap ferme aussi le menu principal.
      event.stopPropagation();
      dropdown.open = false;
      dropdown.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target)) dropdown.open = false;
  });
});
