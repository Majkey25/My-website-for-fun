// The site assistant: on only when the build knows where its API is (see chat/README.md).
import { PUBLIC_CHAT_API, PUBLIC_TURNSTILE_SITE_KEY } from 'astro:env/client';
import type { Lang } from './i18n';

const api = PUBLIC_CHAT_API?.trim().replace(/\/+$/, '');
if (api && !/^(\/|https:\/\/)/.test(api))
  throw new Error('PUBLIC_CHAT_API must be a path or an https URL');

export const chat =
  api && PUBLIC_TURNSTILE_SITE_KEY ? { api, siteKey: PUBLIC_TURNSTILE_SITE_KEY } : null;

export const starters: Record<Lang, string[]> = {
  en: [
    'What does Matěj build with AI?',
    'Which projects show measured results?',
    'Can he train my team to use AI safely?',
    'How do I start working with him?',
  ],
  cs: [
    'Co Matěj vyvíjí s pomocí AI?',
    'Které projekty mají změřené výsledky?',
    'Může proškolit můj tým v bezpečném používání AI?',
    'Jak s ním začít spolupracovat?',
  ],
};
