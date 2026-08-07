# Featured Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live all-repository index with six polished featured projects, a visible typing treatment, a GitHub CTA, and a `Gmail` contact label.

**Architecture:** Keep the site static. Put verified featured-project content directly in `index.html`, style the compact responsive grid in `styles.css`, reuse the existing reveal observer in `menu.js`, and delete the now-unused API client.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, GitHub Pages

---

### Task 1: Replace dynamic project markup

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the dynamic client entry point**

Delete `<script src="projects.js" defer></script>` from the document head.

- [ ] **Step 2: Add the six featured projects**

Replace the loading status and empty list with six static `<li class="project-item" data-reveal>` entries. Each entry must contain one external repository link, its verified owner/name, description, language, and `↗` arrow. Add this CTA after the list:

```html
<a class="projects-cta" href="https://github.com/Majkey25?tab=repositories" target="_blank" rel="noopener noreferrer">
  <span>View all repositories</span>
  <span aria-hidden="true">↗</span>
</a>
```

- [ ] **Step 3: Rename the email link**

Keep `href="mailto:majkeylab@gmail.com"` and change only its visible text to `Gmail`.

- [ ] **Step 4: Check the content shape**

Run:

```powershell
rg -n "projects.js|project-item|View all repositories|mailto:majkeylab@gmail.com|>Gmail<" index.html
```

Expected: no `projects.js`; six `project-item` entries; one GitHub CTA; one Gmail mail link.

### Task 2: Build the compact layout and motion

**Files:**
- Modify: `styles.css`
- Delete: `projects.js`

- [ ] **Step 1: Convert the project list to a responsive grid**

Use two equal columns above the existing mobile breakpoint and one column below it. Give entries hairline borders, compact padding, and consistent minimum height. Clamp `.project-description` to two lines.

- [ ] **Step 2: Keep motion visible and restrained**

Loop the existing source-line typing keyframes with a pause, stagger `.project-item` reveal delays, retain the arrow hover, and make all project motion static under `prefers-reduced-motion: reduce`.

- [ ] **Step 3: Style the GitHub CTA**

Make `.projects-cta` a full-width monochrome row with its arrow aligned right and the same hover/focus movement as project arrows.

- [ ] **Step 4: Remove dead dynamic code**

Delete `projects.js`; no runtime fetch or loading/error state remains.

- [ ] **Step 5: Run syntax and whitespace checks**

Run:

```powershell
node --check menu.js
git diff --check
```

Expected: both commands exit 0.

### Task 3: Validate and publish

**Files:**
- Review: `index.html`
- Review: `styles.css`

- [ ] **Step 1: Validate HTML**

Submit `index.html` to the W3C Nu validator and require zero errors.

- [ ] **Step 2: Exercise live browser scenarios**

Serve the repository locally and verify:

1. Desktop/light: six cards in two columns, looping source typing, working links.
2. Mobile/dark: one column, clamped descriptions, no horizontal overflow.
3. Reduced motion: full source text and cards visible without animation.
4. Regression: theme toggle, navigation, and Gmail link still work.

Expected: no console errors and all assertions pass.

- [ ] **Step 3: Review the final diff**

Run:

```powershell
git diff --stat
git diff --check
git status --short
```

Expected: only the approved site files and planning documents changed; no temporary artifacts.

- [ ] **Step 4: Publish through protected main**

Commit with Conventional Commits, push `feat/featured-projects/07-08-2026`, open a PR, squash-merge it, and wait for GitHub Pages to succeed.

- [ ] **Step 5: Verify production**

Open `https://majkey25.github.io/My-website-for-fun/` and repeat the desktop smoke checks against the deployed page.
