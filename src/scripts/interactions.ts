import { startMatrix } from './matrix';
import { onPage } from './page';

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
  const height = label.scrollHeight;
  const start = performance.now();
  let frame = 0;
  let last = -40;
  const reset = () => {
    cancelAnimationFrame(frame);
    label.textContent = original;
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
      const shown = letters.map((letter, index) => {
        const pool = opening ? (letter === letter.toUpperCase() ? upper : lower) : glyphs;
        return index < count || /\s/.test(letter)
          ? letter
          : pool[Math.floor(Math.random() * pool.length)];
      });
      label.textContent = shown.join('');
      // Settle wider decoys from the right until they fit the reserved text box.
      for (
        let index = letters.length - 1;
        index >= Math.max(0, count) &&
        (label.scrollWidth > label.clientWidth || label.scrollHeight > height);
        index--
      ) {
        shown[index] = letters[index]!;
        label.textContent = shown.join('');
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return reset;
}

onPage((signal) => {
  const stops: (() => void)[] = [];
  const headings = new Map<HTMLElement, () => void>();
  document.querySelectorAll<HTMLElement>('[data-glitch]').forEach((control) => {
    const label = control.querySelector<HTMLElement>('[data-glitch-text]');
    if (!label) return;
    let stop = () => {};
    stops.push(() => stop());
    control.addEventListener('pointerenter', (event) => {
      if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
      stop();
      control.classList.add('is-glitching');
      stop = decode(label, 480, () => control.classList.remove('is-glitching'));
    });
    for (const event of ['pointerleave', 'blur', 'click'])
      control.addEventListener(event, () => stop());
    motion.addEventListener('change', () => stop(), { signal });
  });

  const enter = () => {
    if (motion.matches) return;
    document.querySelectorAll<HTMLElement>('h1 [data-scramble]').forEach((label) => {
      headings.get(label)?.();
      headings.set(
        label,
        decode(
          label,
          Math.min(
            950,
            180 + Math.max(1, Array.from(label.textContent?.trim() ?? '').length - 1) * 55,
          ),
        ),
      );
    });
  };
  addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) enter();
    },
    { signal },
  );

  const matrix = document.querySelector<HTMLCanvasElement>('.matrix-field canvas');
  let stopMatrix = () => {};
  const start = () => {
    enter();
    if (matrix) stopMatrix = startMatrix(matrix);
  };
  if (document.documentElement.classList.contains('intro-active'))
    document.addEventListener('init:intro-finished', start, { once: true, signal });
  else start();

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
    { passive: true, signal },
  );
  const hideGlow = () => {
    cancelAnimationFrame(glowFrame);
    glow?.classList.remove('is-on');
  };
  document.documentElement.addEventListener('pointerleave', hideGlow, { signal });
  motion.addEventListener('change', hideGlow, { signal });
  return () => {
    for (const stop of stops) stop();
    for (const stop of headings.values()) stop();
    stopMatrix();
    hideGlow();
  };
});
