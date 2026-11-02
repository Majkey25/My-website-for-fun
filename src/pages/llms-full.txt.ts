import type { APIRoute } from 'astro';
import { getCases } from '../cases';
import { languages, projectText, ui } from '../i18n';
import { href, profile, slug } from '../site';

export const GET: APIRoute = async ({ site }) => {
  const projects = await getCases();
  const text = languages
    .flatMap((lang) => [
      `# Matěj Teplý | Majkey25 | ${lang}`,
      profile.usernameOrigin[lang],
      `[${ui[lang].about}](${new URL(href('about/', lang), site).href})`,
      ...projects.map((data) => {
        const p = projectText(data, lang);
        return [
          `## ${p.name}`,
          p.kind,
          `[${ui[lang].caseStudy}](${new URL(href(`work/${slug(p.name)}/`, lang), site).href})`,
          `${ui[lang].stack}: ${p.stack.join(', ')}`,
          `${ui[lang].asOf}: ${p.as_of}`,
          `### ${ui[lang].story[0]}\n${p.problem}`,
          `### ${ui[lang].story[1]}\n${p.approach}`,
          `### ${ui[lang].story[2]}\n${p.result}`,
          ...p.links.map((link) => `- [${link.label}](${link.href})`),
          ...(p.source === 'private' ? [ui[lang].privateSource] : []),
        ].join('\n\n');
      }),
      '',
    ])
    .join('\n\n');
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
