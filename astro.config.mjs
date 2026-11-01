// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import { fileURLToPath } from 'node:url';

/** @returns {ReturnType<typeof fontProviders.npm>} */
function localFontsource() {
  const provider = fontProviders.npm({ remote: false });
  return {
    ...provider,
    async resolveFont(options) {
      const result = await provider.resolveFont(options);
      if (!result) throw new Error(`Missing installed font: ${options.familyName}`);
      // The npm provider omits subset metadata needed by Astro's Latin-only preload.
      const fonts = result.fonts.filter((font) => {
        const source = font.src.find((source) => 'url' in source);
        const subset = source?.url.match(
          /-(latin-ext|latin)-(?:standard|wght)-normal\.woff2$/,
        )?.[1];
        if (!subset || !options.subsets.includes(subset)) return false;
        font.meta = { ...font.meta, subset };
        // Astro's font fetcher reads absolute paths; it does not support file: URLs.
        font.src = font.src.map((source) =>
          'url' in source ? { ...source, url: fileURLToPath(source.url) } : source,
        );
        return true;
      });
      if (fonts.length !== options.subsets.length) {
        throw new Error(`Missing installed font subsets: ${options.familyName}`);
      }
      // Astro caches fallback metrics from the first subset; Latin has the sizing glyphs.
      fonts.sort(
        (a, b) =>
          options.subsets.indexOf(a.meta?.subset ?? '') -
          options.subsets.indexOf(b.meta?.subset ?? ''),
      );
      return { ...result, fonts };
    },
  };
}

// Cloudflare is canonical; alternate preview deployments may override --site and --base.
export default defineConfig({
  site: 'https://init-chat.majkeylab.workers.dev',
  compressHTML: true,
  experimental: { parallelPrerender: { workers: 2 } },
  build: { inlineStylesheets: 'always' },
  // The site assistant (chat/) is shown only when both are set at build time.
  env: {
    schema: {
      // '/api' when the Worker also serves the site, otherwise the Worker's absolute URL + '/api'.
      PUBLIC_CHAT_API: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
  fonts: [
    {
      // One family for everything readable; the width axis gives the name its expanded cut.
      provider: localFontsource(),
      name: 'Mona Sans',
      options: { package: '@fontsource-variable/mona-sans', file: 'standard.css' },
      cssVariable: '--font-sans',
      weights: ['200 900'],
      styles: ['normal'],
      stretch: '75% 125%',
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['system-ui', 'Arial', 'sans-serif'],
    },
  ],
});
