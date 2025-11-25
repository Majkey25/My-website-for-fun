const menuToggleButton = document.getElementById('menu-toggle');
const navigation = document.querySelector('nav');

if (menuToggleButton && navigation) {
  menuToggleButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('open');
    menuToggleButton.setAttribute('aria-expanded', String(isOpen));
  });

  navigation.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!navigation.classList.contains('open')) return;
      navigation.classList.remove('open');
      menuToggleButton.setAttribute('aria-expanded', 'false');
    });
  });
}
