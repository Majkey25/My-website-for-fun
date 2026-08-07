const root = document.documentElement;
const header = document.querySelector('.site-header, body > nav');
const menuToggle = document.getElementById('menu-toggle');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.querySelector('[data-theme-label]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function closeMenu() {
  if (!header || !menuToggle) return;
  header.classList.remove('menu-open', 'open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

if (header && menuToggle) {
  menuToggle.addEventListener('click', () => {
    const menuClass = header.classList.contains('site-header')
      ? 'menu-open'
      : 'open';
    const isOpen = header.classList.toggle(menuClass);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  header.querySelectorAll('nav a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

function updateTheme(theme) {
  const isDark = theme === 'dark';
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // The selected theme still applies when storage is unavailable.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    isDark ? '#101010' : '#ffffff'
  );

  if (!themeToggle || !themeLabel) return;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute(
    'aria-label',
    `Switch to ${isDark ? 'light' : 'dark'} theme`
  );
  themeLabel.textContent = isDark ? 'Light' : 'Dark';
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem('theme');
} catch {
  // Use the system preference when storage is unavailable.
}

const initialTheme = root.dataset.theme === 'dark' || savedTheme === 'dark'
  ? 'dark'
  : 'light';
updateTheme(initialTheme);

themeToggle?.addEventListener('click', (event) => {
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const applyTheme = () => updateTheme(nextTheme);

  if (!document.startViewTransition || reducedMotion.matches) {
    applyTheme();
    return;
  }

  const transition = document.startViewTransition(applyTheme);
  const toggleBounds = themeToggle.getBoundingClientRect();
  const x = event.detail === 0
    ? toggleBounds.left + toggleBounds.width / 2
    : event.clientX;
  const y = event.detail === 0
    ? toggleBounds.top + toggleBounds.height / 2
    : event.clientY;
  const radius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y)
  );

  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0 at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    })
    .catch(() => {
      // The theme already changed; only the optional reveal animation failed.
    });
});

const revealElements = document.querySelectorAll('[data-reveal]');

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealElements.forEach((element) => element.classList.add('is-visible'));
} else {
  root.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
}

const navigationLinks = document.querySelectorAll('.site-nav a[href^="#"]');
const observedSections = document.querySelectorAll('main section[id]');

if ('IntersectionObserver' in window && navigationLinks.length > 0) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navigationLinks.forEach((link) => {
          const isCurrent = link.getAttribute('href') === `#${entry.target.id}`;
          if (isCurrent) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    },
    // A 1px band across the middle of the viewport. Sections tile the page, so
    // exactly one always crosses it — including the last one at the very bottom,
    // which the old bottom-heavy margin could never reach.
    { rootMargin: '-50% 0px -50% 0px' }
  );

  observedSections.forEach((section) => sectionObserver.observe(section));
}

const emailButton = document.querySelector('[data-copy-email]');

if (emailButton) {
  const defaultLabel = emailButton.textContent;
  const SPARK_COUNT = 10;
  let resetTimer = 0;

  const sparkle = () => {
    if (reducedMotion.matches) return;
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      const angle = (index / SPARK_COUNT) * 2 * Math.PI;
      const distance = 26 + Math.random() * 18;
      spark.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      spark.addEventListener('animationend', () => spark.remove());
      emailButton.append(spark);
    }
  };

  emailButton.addEventListener('click', async () => {
    const email = emailButton.dataset.copyEmail;
    let copied = false;
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch {
      // Clipboard access can be blocked; show the address so it can be copied by hand.
    }

    clearTimeout(resetTimer);
    emailButton.textContent = copied ? 'Copied!' : email;
    if (copied) {
      emailButton.dataset.copied = '';
      sparkle();
    }

    resetTimer = setTimeout(() => {
      emailButton.textContent = defaultLabel;
      delete emailButton.dataset.copied;
    }, 1800);
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
