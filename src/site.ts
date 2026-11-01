// Site-wide paths and the owner's public profile.

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Path inside the site, including an optional deployment base: href('work/') -> /work/. */
export const href = (path = '', lang: 'en' | 'cs' = 'en') =>
  `${base}${lang === 'cs' ? 'cs/' : ''}${path}`;

/** URL part of a project page: "Selia Weather" -> "selia-weather". */
export const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const profile = {
  email: 'majkeylab@gmail.com',
  web3formsAccessKey: '76152ab0-19d3-4ab4-b904-db44803a9c51',
  socials: [
    { label: 'GitHub', href: 'https://github.com/Majkey25' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/matejteply/' },
    { label: 'X', href: 'https://x.com/TeplyMatej' },
    { label: 'Instagram', href: 'https://www.instagram.com/_majkey_/' },
  ],
} as const;

export const groups = {
  ai: 'AI and language',
  tools: 'Developer tools',
  web: 'Web',
  android: 'Android',
  extensions: 'Browser extensions',
  earlier: 'Earlier and small tools',
} as const;
