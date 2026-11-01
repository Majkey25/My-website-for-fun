import type { APIRoute } from 'astro';
import { getCases } from '../cases';
import { languages } from '../i18n';
import { href, slug } from '../site';

export const GET: APIRoute = async ({ site }) => {
  const cases = await getCases();
  const paths = languages.flatMap((lang) =>
    [
      '',
      'work/',
      'services/',
      'about/',
      'contact/',
      'privacy/',
      ...cases.map((p) => `work/${slug(p.name)}/`),
    ].map((path) => href(path, lang)),
  );
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
