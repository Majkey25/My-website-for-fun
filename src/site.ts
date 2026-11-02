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
  usernameOrigin: {
    cs: 'Majkey25 je moje uživatelské jméno na GitHubu. Spojuje křestní jméno Matěj, dětskou přezdívku, její výslovnost a oblíbené číslo 25. Líbí se mi také podobnost s anglickým „my key“, tedy „můj klíč“.',
    en: 'Majkey25 is my GitHub username. It combines my first name, Matěj, a childhood nickname, its pronunciation and my favourite number, 25. I also like its resemblance to the English phrase “my key”.',
  },
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
