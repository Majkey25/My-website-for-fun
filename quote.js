(function () {
  const quoteTextElement = document.getElementById('quote-text');
  const quoteButtonElement = document.getElementById('quote-button');
  let typingInProgress = false;

  function pickRandomQuote() {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    return QUOTES[randomIndex];
  }

  async function animateQuote() {
    if (typingInProgress) return;
    typingInProgress = true;

    try {
      if (window.Typewriter && quoteTextElement) {
        const nextQuote = pickRandomQuote();
        await window.Typewriter.typeLine(quoteTextElement, nextQuote);
      } else if (quoteTextElement) {
        quoteTextElement.textContent = pickRandomQuote();
      }
    } finally {
      typingInProgress = false;
    }
  }

  quoteButtonElement.addEventListener('click', (event) => {
    event.preventDefault();
    animateQuote();
  });

  document.documentElement.style.setProperty('--QUOTE_FADE_MS', `${QUOTE_FADE_MS}ms`);
  animateQuote();
})();
