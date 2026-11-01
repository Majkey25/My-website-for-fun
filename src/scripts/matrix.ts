/** The intro and page share one bounded rain renderer; stopping removes its listeners. */
export function startMatrix(canvas: HTMLCanvasElement, color?: string) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let last = -40;
  let width = 0;
  let height = 0;
  let size = 22;
  let ink = '';
  let streams: { x: number; y: number; speed: number }[] = [];
  const glyphs = '01{}[]<>/=+*;:#$_';
  const theme = () => {
    ink = color ?? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  };
  const resize = () => {
    width = canvas.width = Math.min(canvas.clientWidth, 1920);
    height = canvas.height = Math.min(canvas.clientHeight, 1200);
    size = width < 600 ? 18 : 22;
    context.font = `${size - 4}px monospace`;
    streams = Array.from({ length: Math.ceil(width / size) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 0.55 + Math.random() * 0.5,
    }));
  };
  const draw = (now: number) => {
    if (now - last >= 40) {
      last = now;
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = 'rgb(0 0 0 / 0.14)';
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = ink;
      for (const stream of streams) {
        context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)]!, stream.x, stream.y);
        stream.y += size * stream.speed;
        if (stream.y > height + size) {
          stream.x = Math.random() * width;
          stream.y = -Math.random() * size * 12;
        }
      }
    }
    frame = requestAnimationFrame(draw);
  };
  const run = () => {
    cancelAnimationFrame(frame);
    last = -40;
    if (!document.hidden && !motion.matches) {
      resize();
      frame = requestAnimationFrame(draw);
    }
  };
  const observer = new MutationObserver(theme);
  if (!color)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  theme();
  run();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', run);
  motion.addEventListener('change', run);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', run);
    motion.removeEventListener('change', run);
    observer.disconnect();
  };
}
