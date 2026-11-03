/** Own page listeners and animation cleanup across Astro swaps, without delaying first load. */
export function onPage(init: (signal: AbortSignal) => void | (() => void)) {
  let body: HTMLElement | undefined;
  let dispose = () => {};
  const mount = () => {
    if (body === document.body) return;
    dispose();
    body = document.body;
    const owner = new AbortController();
    const cleanup = init(owner.signal);
    dispose = () => {
      owner.abort();
      cleanup?.();
    };
  };
  mount();
  document.addEventListener('astro:after-swap', mount);
  document.addEventListener('astro:page-load', mount);
  document.addEventListener('astro:before-swap', () => {
    dispose();
    dispose = () => {};
    body = undefined;
  });
}
