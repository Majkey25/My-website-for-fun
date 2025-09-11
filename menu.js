const menuToggleButton = document.getElementById('menu-toggle');
const navigation = document.querySelector('nav');

menuToggleButton.addEventListener('click', () => {
  navigation.classList.toggle('open');
});
