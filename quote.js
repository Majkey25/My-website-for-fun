(function () {
  const quoteTextElement = document.getElementById('quote-text');
  const quoteButtonElement = document.getElementById('quote-button');

  function setRandomQuote() {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    quoteTextElement.textContent = QUOTES[randomIndex];
  }

  quoteButtonElement.addEventListener('click', (event) => {
    event.preventDefault();
    quoteTextElement.classList.add('fade');
    setTimeout(() => {
      setRandomQuote();
      quoteTextElement.classList.remove('fade');
    }, QUOTE_FADE_MS);
  });

  document.documentElement.style.setProperty('--QUOTE_FADE_MS', `${QUOTE_FADE_MS}ms`);
  setRandomQuote();
})();
