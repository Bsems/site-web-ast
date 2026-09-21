const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-navigation');

toggle?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.querySelector('.sr-only').textContent = isOpen ? 'Fermer le menu' : 'Ouvrir le menu';
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});
