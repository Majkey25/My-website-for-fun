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
      en: 'SeliaScan, formerly ScanIt: document capture, PDF sharing, file details and signatures.',
      cs: 'SeliaScan, dříve ScanIt: skenování dokumentu, sdílení PDF, podrobnosti souboru a podpisy.',
    },
    source: 'https://github.com/Majkey25/ScanIt/blob/HEAD/docs/images/scanit-current-overview.png',
  },
  Intoniva: {
    image: tuner,
    alt: {
      en: 'Intoniva store artwork showing its instrument tuner and pitch display.',
      cs: 'Veřejný obrázek Intonivy s ladičkou nástrojů a zobrazením výšky tónu.',
    },
    source:
      'https://github.com/Majkey25/TuneItAll/blob/HEAD/fastlane/metadata/android/en-US/images/phoneScreenshots/1_tuner.png',
  },
  'Selia Weather': {
    image: weather,
    alt: {
      en: 'Selia Weather store artwork showing current conditions and an hourly forecast.',
      cs: 'Veřejný obrázek Selia Weather s aktuálním počasím a hodinovou předpovědí.',
    },
    source:
      'https://github.com/Majkey25/Selia-Weather/blob/HEAD/fastlane/metadata/android/en-US/images/phoneScreenshots/01-weather.png',
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
