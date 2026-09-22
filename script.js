const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-navigation');

function setMenu(open) {
  navigation.classList.toggle('is-open', open);
  if (!open) navigation.querySelectorAll('details[open]').forEach(dropdown => { dropdown.open = false; });
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.sr-only').textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
}

if (toggle && navigation) {
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
}

document.querySelectorAll('.club-dropdown').forEach(dropdown => {
  dropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dropdown.open) {
      event.stopPropagation();
      dropdown.open = false;
      dropdown.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target)) dropdown.open = false;
  });
});
