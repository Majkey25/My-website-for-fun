import type { APIRoute } from 'astro';
import { getCases } from '../cases';
import { href, slug } from '../site';

export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(href(path), site).href;
  const projects = await getCases();
  return new Response(
    [
      '# Matěj Teplý | Majkey25',
      '> Applied AI/ML engineer and technology consultant in Zlín, Czechia. Public projects, services and professional background.',
      'Project descriptions summarize public documentation. Dated results retain their scope and limitations. Prices, availability and confidential work require direct confirmation.',
      '## Profile and cooperation',
      `- [About](${url('about/')}): Experience, education and the origin of Majkey25.`,
      `- [Services](${url('services/')}): AI consulting, integration, training and software development.`,
      `- [Contact](${url('contact/')}): Ask about a project, pricing or availability.`,
      `- [Český web](${url('cs/')}): Czech profile, services and project descriptions.`,
      '## Project documentation',
      `- [Complete bilingual project text](${url('llms-full.txt')}): The same descriptions and source links as the HTML detail pages, without scripts or decoration.`,
      ...projects.map((p) => `- [${p.name}](${url(`work/${slug(p.name)}/`)}): ${p.kind}.`),
      '## Optional',
      '- [GitHub](https://github.com/Majkey25): Public source repositories and README files.',
      `- [Sitemap](${url('sitemap.xml')}): All canonical English and Czech HTML pages.`,
      `- [Privacy](${url('privacy/')}): How the public assistant handles conversations and attachments.`,
      '',
    ].join('\n\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
