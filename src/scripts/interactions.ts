import { startMatrix } from './matrix';

// Visual text decodes independently of the accessible name and reserved label width.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const glyphs = '01<>/{}[]_+#';
const upper = 'ABCDEFGHKLMNPRSTUVXYZ';
const lower = 'abcdeghknopqrsuvxyz';

function decode(label: HTMLElement, duration: number, done = () => {}) {
  const original =
    label.closest<HTMLElement>('[data-text]')?.dataset.text ?? label.textContent?.trim() ?? '';
  const letters = Array.from(original);
  const opening = label.hasAttribute('data-scramble');
  const whiteSpace = label.style.whiteSpace;
  // Wider scramble glyphs must not turn a one-line label into a clipped second line.
  if (label.getBoundingClientRect().height < parseFloat(getComputedStyle(label).lineHeight) * 1.5)
    label.style.whiteSpace = 'nowrap';
  const start = performance.now();
  let frame = 0;
  let last = -40;
  const reset = () => {
    cancelAnimationFrame(frame);
    label.textContent = original;
    label.style.whiteSpace = whiteSpace;
    done();
  };
  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= duration || motion.matches || document.hidden) return reset();
    if (elapsed - last >= 40) {
      last = elapsed;
      const count = opening
        ? Math.floor(((elapsed - 180) / Math.max(1, duration - 180)) * (letters.length - 1)) + 1
        : Math.floor((elapsed / 400) * letters.length);
      label.textContent = letters
        .map((letter, index) => {
          const pool = opening ? (letter === letter.toUpperCase() ? upper : lower) : glyphs;
          return index < count || /\s/.test(letter)
            ? letter
            : pool[Math.floor(Math.random() * pool.length)];
        })
        .join('');
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return reset;
}

document.querySelectorAll<HTMLElement>('[data-glitch]').forEach((control) => {
  const label = control.querySelector<HTMLElement>('[data-glitch-text]');
  if (!label) return;
  let stop = () => {};
  control.addEventListener('pointerenter', (event) => {
    if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
    stop();
    control.classList.add('is-glitching');
    stop = decode(label, 480, () => control.classList.remove('is-glitching'));
  });
  for (const event of ['pointerleave', 'blur', 'click'])
    control.addEventListener(event, () => stop());
  motion.addEventListener('change', () => stop());
});

const enter = () => {
  if (motion.matches) return;
  document
    .querySelectorAll<HTMLElement>('h1 [data-scramble]')
    .forEach((label) =>
      decode(
        label,
        Math.min(
          950,
          180 + Math.max(1, Array.from(label.textContent?.trim() ?? '').length - 1) * 55,
        ),
      ),
    );
};
if (document.documentElement.classList.contains('intro-active'))
  document.addEventListener('init:intro-finished', enter, { once: true });
else enter();
addEventListener('pageshow', (event) => {
  if (event.persisted) enter();
});

const matrix = document.querySelector<HTMLCanvasElement>('.matrix-field canvas');
const rain = () => {
  if (matrix) startMatrix(matrix);
};
if (document.documentElement.classList.contains('intro-active'))
  document.addEventListener('init:intro-finished', rain, { once: true });
else rain();

const glow = document.querySelector<HTMLElement>('.spotlight');
let glowFrame = 0;
addEventListener(
  'pointermove',
  (event) => {
    if (!glow || motion.matches || !pointer.matches || event.pointerType === 'touch') return;
    cancelAnimationFrame(glowFrame);
    glowFrame = requestAnimationFrame(() => {
      glow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      glow.classList.add('is-on');
    });
  },
  { passive: true },
);
const hideGlow = () => {
  cancelAnimationFrame(glowFrame);
  glow?.classList.remove('is-on');
};
document.documentElement.addEventListener('pointerleave', hideGlow);
motion.addEventListener('change', hideGlow);
