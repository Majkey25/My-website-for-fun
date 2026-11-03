# Matěj Teplý

Personal site of Matěj Teplý (Majkey), AI/ML engineer and backend developer:
**[init-chat.majkeylab.workers.dev](https://init-chat.majkeylab.workers.dev/)**

[![CI](https://github.com/Majkey25/init/actions/workflows/ci.yml/badge.svg)](https://github.com/Majkey25/init/actions/workflows/ci.yml)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)](https://astro.build)

## What is here

- **Home**: a short introduction, six selected projects in a gallery driven by page scrolling, and links to the full pages. The gallery pins while scrolling sideways; reduced motion and short viewports use native horizontal scrolling.
- **/services/**: AI strategy, integration, training, software development and working approach.
- **/about/**: biography, experience, education, skills, credentials and music.
- **/contact/**: project enquiries, the contact form and protected email controls.
- **Site assistant**: ask about my work and get a streamed answer with numbered sources from this
  site and my public repositories. A Cloudflare Worker with AI Search and OpenAI; see
  [`chat/README.md`](chat/README.md). It appears only when the build is given its API address.
- **/work/&lt;project&gt;/**: one page per selected project, written as problem → approach →
  result (with measured numbers and known limits where I have them).
- **[/work/](https://init-chat.majkeylab.workers.dev/work/)**: public projects, grouped.
- Decorative motion is off under `prefers-reduced-motion`: a fullscreen Matrix boot sequence plays once per tab, headings decode on each page opening, content
  rises in, hovering a project quiets the others and splits its name for a moment, the assistant's panel
  slides in, answers stream behind a caret and their sources follow one by one, and the theme
  switch opens as a circle from its button. Pointer hover briefly decodes visual action labels while their accessible names stay unchanged. The intro and page share capped canvas rain with randomly placed streams; background tabs pause it. A cursor glow follows fine pointers. A blue line tracks reading progress on every page, including with
  reduced motion. Each page keeps its own brief content entrance.
- On desktop, an animated wireframe workbench fills the hero's assistant slot while AI is off.
  It is removed automatically when the assistant is enabled. The configured assistant has a
  bottom-right launcher on desktop and phones; phone navigation uses a native menu popover.
- Light and dark theme (follows the system, remembers a manual choice), a session-only Matrix surprise offered randomly as the third to eighth theme choice, and a print stylesheet. Theme progress survives navigation within the tab; an information icon beside the control offers a hint.

## Editing

Projects live in [`src/data/projects.yaml`](src/data/projects.yaml), validated by a Zod schema in
[`src/content.config.ts`](src/content.config.ts): a featured project without problem, approach,
result and `as_of` fails the build. A project's page URL comes from its name.

## Stack

Astro 7 (static), plain CSS, Mona Sans (its width axis gives the name its expanded cut) through
the Astro Fonts API. The assistant is a native custom element and `<dialog>`, no framework. CI runs
Prettier, `astro check`, the build, the Worker's type check and tests, and Lighthouse CI. The
canonical host is Cloudflare. GitHub Pages only redirects legacy links, preserving paths,
queries and anchors; its old full-site deployment workflow remains disabled.
Astro's built-in client router prefetches internal pages and swaps their content without a full
reload. Page listeners, animation loops and pending chat work are released before each swap;
theme choice and saved conversations survive, and each incoming heading still decodes.
The current release serves the site with the assistant off. The manual `Deploy to Cloudflare`
workflow defaults to static assets and requires the shared CodeQL gate, audits, types, tests
and build before deployment. Its `enable_ai` input enables the configured assistant only after
the account, retrieval and security release checks pass. Both modes use immutable caching and security headers
([`public/_headers`](public/_headers)).
