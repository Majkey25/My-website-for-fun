(function () {
  const revealables = document.querySelectorAll('[data-reveal]');

  function revealAll() {
    revealables.forEach((element) => element.classList.add('revealed'));
  }

  if (!('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        element.style.setProperty('--reveal-offset', `${REVEAL_OFFSET_PX}px`);
        element.classList.add('revealed');
        observer.unobserve(element);
      });
    },
    { threshold: REVEAL_THRESHOLD }
  );

  revealables.forEach((element, index) => {
    const delayMs = index * REVEAL_STAGGER_MS;
    element.style.setProperty('--reveal-delay', `${delayMs}ms`);
    observer.observe(element);
  });
})();
