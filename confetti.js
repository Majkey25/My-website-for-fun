(() => {
  const teaser = document.querySelector('.projects-more');
  if (!teaser) {
    return;
  }

  teaser.addEventListener('mouseenter', () => {
    for (let index = 0; index < CONFETTI_COUNT; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
      piece.style.setProperty('--confetti-color', color);
      piece.style.setProperty('--size', `${CONFETTI_SIZE_PX}px`);
      const offsetX = (Math.random() - 0.5) * CONFETTI_SPREAD_PX;
      const offsetY = (Math.random() - 0.5) * CONFETTI_SPREAD_PX -
        CONFETTI_SPREAD_PX;
      piece.style.setProperty('--x', `${offsetX}px`);
      piece.style.setProperty('--y', `${offsetY}px`);
      piece.style.setProperty('--duration', `${CONFETTI_DURATION_MS}ms`);
      teaser.appendChild(piece);
      setTimeout(() => piece.remove(), CONFETTI_DURATION_MS);
    }
  });
})();
