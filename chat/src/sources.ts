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
  'https://raw.githubusercontent.com/Majkey25/art_by_justyna/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/buffoncalc/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/ByteNoise/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/calculator/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/chromium-tab-equalizer/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/DownloadGithubDir/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/exhalace/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/File-Lock/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/gh-issues-pr-export/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/init/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/Intoniva/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/little-ai/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/little-clip-factory/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/Location-Mock/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/Majkey25.github.io/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/margin-md/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/no-cookies-ads/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/page-copy-extension/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/QR-Code-Scanner-Creator/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/ScanIt/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/scrollit/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/selia-lists/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/selia-wake/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/SeliaCycles/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/SeliaSheets/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/skloservis-brod/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/songsterr-auto-continue/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/SumRead/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/tab-copy-extension/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/wheel/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/youtube_downloader/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/youtube-skipper/main/README.md',
  'https://raw.githubusercontent.com/Majkey25/zpevnicek/master/README.md',
  'https://raw.githubusercontent.com/Majkey25/Selia-Weather/main/research/README.md',
  'https://raw.githubusercontent.com/StudentTraineeCenter/music-analyzer/main/README.md',
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
  'https://raw.githubusercontent.com/StudentTraineeCenter/music-analyzer',
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
  [
    'github-projects.md',
    { title: 'Public GitHub repository inventory | 1 November 2026', url: null },
  ],
]);

/** Identifies the crawler to site owners, as robots.txt rules expect. */
export const USER_AGENT = 'init-chat-crawler/1.0 (+https://init-chat.majkeylab.workers.dev/)';
