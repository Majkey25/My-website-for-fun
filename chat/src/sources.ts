// What the assistant may learn from. The crawl never leaves the hosts listed here.

/** Every page in these sitemaps is indexed. */
export const SITEMAPS = ['https://init-chat.majkeylab.workers.dev/sitemap.xml'];

/** Single documents: Markdown, HTML or PDF. */
export const DOCUMENTS = [
  'https://raw.githubusercontent.com/Majkey25/Majkey25/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/CzechCore/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/Selia-Weather/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/prompt-engineering-skill/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/Project-Guard/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/project-board-showcase/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/transcriber-android/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/local-voice-android/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/rc-audio-lab/HEAD/README.md',
  'https://raw.githubusercontent.com/Majkey25/WeTheGods/HEAD/README.md',
];

/**
 * The owner's own profiles and sites, from `src/site.ts` and `src/data/projects.yaml`. Live web
 * search keeps a fact only when every page it cites is one of these or lies below one (see
 * web.ts). A host with path `/` counts whole; a query, when given, must match exactly.
 */
export const OWNER_PAGES = [
  'https://init-chat.majkeylab.workers.dev/',
  'https://majkey25.github.io/',
  'https://github.com/Majkey25',
  'https://raw.githubusercontent.com/Majkey25',
  'https://github.com/StudentTraineeCenter/music-analyzer',
  'https://www.linkedin.com/in/matejteply',
  'https://cz.linkedin.com/in/matejteply',
  'https://x.com/TeplyMatej',
  'https://twitter.com/TeplyMatej',
  'https://www.instagram.com/_majkey_',
  'https://project-board.majkeylab.workers.dev/',
  'https://www.skloservis-brod.cz/',
  'https://www.exhalace.cz/',
  'https://play.google.com/store/apps/details?id=com.tuneitall.tuner',
];

/**
 * Files the owner uploads to AI Search by hand, by item key. No unrelated profile is presented
 * as a link to the document. The CV itself never lives in this repository.
 */
export const OWNER_FILES = new Map([
  ['owner-cv.md', { title: 'Matej_Teply_CV_EXT_26.pdf', url: null }],
  ['owner-cv-page-1.md', { title: 'Matej_Teply_CV_EXT_26.pdf | p. 1', url: null }],
  ['owner-cv-page-2.md', { title: 'Matej_Teply_CV_EXT_26.pdf | p. 2', url: null }],
  ['owner-updates.md', { title: 'Owner-confirmed updates', url: null }],
  ['owner-profile.md', { title: 'Public professional profile | 1 November 2026', url: null }],
]);

/** Identifies the crawler to site owners, as robots.txt rules expect. */
export const USER_AGENT = 'init-chat-crawler/1.0 (+https://init-chat.majkeylab.workers.dev/)';
