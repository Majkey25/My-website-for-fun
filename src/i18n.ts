import type { CollectionEntry } from 'astro:content';
import { groups } from './site';

export const languages = ['en', 'cs'] as const;
export type Lang = (typeof languages)[number];

export const ui = {
  en: {
    services: 'Services',
    work: 'Work',
    about: 'About',
    contact: 'Contact',
    main: 'Main',
    menu: 'Menu',
    language: 'Language',
    theme: 'Switch theme',
    themeHint: 'Theme hint',
    themeSurprise: 'Try switching themes. You might find a surprise.',
    skip: 'Skip to content',
    privacy: 'Privacy',
    source: 'source',
    typography: 'set in Mona Sans · built with Astro',
    problem: 'problem',
    title: 'Matěj Teplý: applied AI, strategy and training',
    description:
      'Matěj Teplý, AI/ML engineer and backend developer in Zlín. Builds AI and software products, helps organizations adopt AI and trains employees to use it safely.',
    allProjects: 'All projects',
    groups: 'Groups',
    caseStudy: 'case study',
    formerly: 'formerly',
    privateSource: 'source private',
    area: 'area',
    stack: 'stack',
    asOf: 'as of',
    story: ['Problem', 'Approach', 'Result'],
    example: 'example',
    links: 'Links',
    nextProject: 'Next project',
    next: 'next',
    mail: 'Mail me',
    copy: 'Copy email',
  },
  cs: {
    services: 'Služby',
    work: 'Projekty',
    about: 'O mně',
    contact: 'Kontakt',
    main: 'Hlavní navigace',
    menu: 'Menu',
    language: 'Jazyk',
    theme: 'Změnit motiv',
    themeHint: 'Nápověda k motivům',
    themeSurprise: 'Zkuste přepínat motiv. Možná objevíte překvapení.',
    skip: 'Přejít na obsah',
    privacy: 'Soukromí',
    source: 'zdrojový kód',
    typography: 'písmo Mona Sans · vytvořeno v Astro',
    problem: 'problém',
    title: 'Matěj Teplý: aplikovaná AI, strategie a školení',
    description:
      'Matěj Teplý, AI/ML engineer a backend vývojář ze Zlína. Vyvíjí AI a software, pomáhá firmám zavádět AI a učí zaměstnance používat ji bezpečně.',
    allProjects: 'Všechny projekty',
    groups: 'Kategorie',
    caseStudy: 'případová studie',
    formerly: 'dříve',
    privateSource: 'neveřejný zdrojový kód',
    area: 'oblast',
    stack: 'technologie',
    asOf: 'stav k',
    story: ['Problém', 'Postup', 'Výsledek'],
    example: 'příklad',
    links: 'Odkazy',
    nextProject: 'Další projekt',
    next: 'další',
    mail: 'Napsat e-mail',
    copy: 'Kopírovat e-mail',
  },
};

export const groupLabels = {
  en: groups,
  cs: {
    ai: 'AI a jazyk',
    tools: 'Vývojářské nástroje',
    web: 'Web',
    android: 'Android',
    extensions: 'Rozšíření prohlížeče',
    earlier: 'Starší a malé nástroje',
  },
};

const linkLabels: Record<string, string> = {
  Repository: 'Repozitář',
  'Live app': 'Otevřít aplikaci',
  Showcase: 'Prezentace',
  'Open the lab': 'Otevřít laboratoř',
  Website: 'Web',
  Open: 'Otevřít',
  'Project page': 'Stránka projektu',
  'Replay report': 'Zpráva z vyhodnocení',
};

export const projectText = (project: CollectionEntry<'projects'>['data'], lang: Lang) => ({
  ...project,
  ...(lang === 'cs' ? project.cs : {}),
  links: project.links.map((link) => ({
    ...link,
    label: lang === 'cs' ? (linkLabels[link.label] ?? link.label) : link.label,
  })),
});
