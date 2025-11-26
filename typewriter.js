(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const baseSpeed = prefersReduced ? TYPE_SPEED_MS * TYPE_REDUCED_FACTOR : TYPE_SPEED_MS;
  const pauseMs = TYPE_PAUSE_MS;

  function typeLine(element, text) {
    return new Promise((resolve) => {
      if (!element) {
        resolve();
        return;
      }

      let index = 0;
      element.dataset.typing = 'true';

      function step() {
        element.textContent = text.slice(0, index);
        index += 1;
        if (index <= text.length) {
          setTimeout(step, baseSpeed);
          return;
        }
        element.dataset.typing = 'false';
        setTimeout(resolve, pauseMs / 2);
      }

      step();
    });
  }

  function startLoop(element) {
    const wordsRaw = element.dataset.words || element.textContent;
    const words = wordsRaw
      .split('|')
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    if (words.length === 0) return;

    async function cycle() {
      let currentIndex = 0;
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        await typeLine(element, words[currentIndex]);
        currentIndex = (currentIndex + 1) % words.length;
      }
    }

    cycle();
  }

  function initLoops() {
    document
      .querySelectorAll('[data-typewriter-loop]')
      .forEach((element) => startLoop(element));
  }

  window.Typewriter = { typeLine, startLoop };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoops);
  } else {
    initLoops();
  }
})();
