import type { ImageMetadata } from 'astro';
import type { Lang } from './i18n';
import board from './assets/projects/project-board.webp';
import scan from './assets/projects/seliascan.png';
import tuner from './assets/projects/intoniva.png';
import weather from './assets/projects/selia-weather.png';
import band from './assets/projects/wethegods.jpg';
import glass from './assets/projects/skloservis-brod.jpg';

// Existing public product images, shared by the work reel and their case studies.
export const projectMedia: Record<
  string,
  | {
      image: ImageMetadata;
      alt: Record<Lang, string>;
      source: string;
    }
  | undefined
> = {
  'Project board': {
    image: board,
    alt: {
      en: 'Project board showing planned work, development, code review and testing with demo projects.',
      cs: 'Project board s ukázkovými projekty ve sloupcích plánování, vývoje, kontroly kódu a testování.',
    },
    source:
      'https://github.com/Majkey25/project-board-showcase/blob/HEAD/assets/shot-board-dark.webp',
  },
  SeliaScan: {
    image: scan,
    alt: {
      en: 'Earlier ScanIt result screen with a scanned document and PDF sharing controls. The app is now called SeliaScan.',
      cs: 'Starší obrazovka výsledku ScanIt s dokumentem a sdílením PDF. Aplikace se nyní jmenuje SeliaScan.',
    },
    source: 'https://github.com/Majkey25/ScanIt/blob/HEAD/docs/images/screenshots/result.png',
  },
  Intoniva: {
    image: tuner,
    alt: {
      en: 'Intoniva tuner screen showing guitar strings, detected pitch and cents deviation.',
      cs: 'Obrazovka ladičky Intoniva se strunami kytary, rozpoznaným tónem a odchylkou v centech.',
    },
    source:
      'https://github.com/Majkey25/Intoniva/blob/HEAD/docs/store/source-captures/2026-10-03/en-US/1_tuner.png',
  },
  'Selia Weather': {
    image: weather,
    alt: {
      en: 'Selia Weather app showing current conditions in Prague and an hourly forecast.',
      cs: 'Aplikace Selia Weather s aktuálním počasím v Praze a hodinovou předpovědí.',
    },
    source:
      'https://github.com/Majkey25/Selia-Weather/blob/HEAD/docs/store/captures/2026-10-11/en-US/01-weather.png',
  },
  WeTheGods: {
    image: band,
    alt: {
      en: 'WeTheGods website artwork, with its logo over a live concert photograph.',
      cs: 'Obrázek z webu WeTheGods s logem kapely a fotografií z koncertu.',
    },
    source: 'https://github.com/Majkey25/WeTheGods/blob/HEAD/public/og.jpg',
  },
  'Skloservis Brod': {
    image: glass,
    alt: {
      en: 'Glass office partitions photographed for the Skloservis Brod website.',
      cs: 'Fotografie skleněných kancelářských příček z webu Skloservis Brod.',
    },
    source:
      'https://github.com/Majkey25/skloservis-brod/blob/HEAD/src/assets/gallery/office-glass-corridor.jpg',
  },
};
