# Featured Projects Design

## Goal

Replace the long live repository index with a focused, hardcoded showcase that is faster to scan and visually consistent with the portfolio.

## Approved design

- Show the six public repositories pinned in the supplied GitHub screenshot.
- Use a two-column grid on desktop and one column on narrow screens.
- Keep each item fully clickable with a short description, language, and external-link arrow.
- Limit descriptions to two lines so the section stays compact.
- Add a full-width `View all repositories` link to the GitHub repositories page.
- Change the contact link label from the address to `Gmail`; keep `mailto:majkeylab@gmail.com`.

## Featured repositories

1. `StudentTraineeCenter/music-analyzer`
2. `Majkey25/scrollit`
3. `Majkey25/gh-issues-pr-export`
4. `Majkey25/ScanIt`
5. `Majkey25/Project-Guard`
6. `Majkey25/tab-copy-extension`

Descriptions and languages use metadata verified from the GitHub REST API on 2026-08-07.

## Motion

- Loop a restrained typing treatment on the Projects source line so it remains noticeable after page load.
- Stagger project entrances when the section scrolls into view.
- Move the external-link arrow slightly on hover or keyboard focus.
- Disable typing and entrance motion when `prefers-reduced-motion: reduce` is active.

## Boundaries

- Remove the GitHub API fetch and `projects.js`; hardcoded featured work is intentional.
- Keep the existing static HTML/CSS/JavaScript stack and theme system.
- Add no dependencies, framework, carousel, images, badges, or extra configuration.

## Verification

- Validate HTML and JavaScript syntax.
- Check desktop, mobile, light, dark, and reduced-motion layouts in a real browser.
- Verify all six repository links, the GitHub CTA, and the Gmail link.
- Confirm no horizontal overflow or browser console errors.
