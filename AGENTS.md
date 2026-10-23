# Repository Guide

## Project

- This is a static, Italian-language browser game catalog deployed with GitHub Pages.
- GitHub Pages publishes `public/`; there is no application framework or build step.
- Keep site-owned markup, styles, and scripts in `public/`. Browser scripts use native ES modules.

## Main Files

- `public/index.html` is the catalog page.
- `public/assets/games.js` is the source of game metadata and page URL generation.
- `public/assets/catalog.js` renders the catalog; `player.js` and `fullscreen.js` power game pages.
- `public/giochi/` contains game pages. Use `public/giochi/polytrack/index.html` as the template for another game.
- `public/builds/` contains game build assets. Treat supplied/vendor build files as immutable unless a task explicitly targets them.
- `.github/workflows/pages.yml` publishes the static site from `public/`.

## Changes and Checks

- Follow the existing plain HTML, CSS, and JavaScript patterns; avoid adding a framework or build pipeline for routine changes.
- When adding a game, update `public/assets/games.js`, add its local build under `public/builds/<slug>/`, and create its page under `public/giochi/<slug>/`. Preserve attribution and only publish builds with appropriate rights.
- No automated test or build command is configured. For a local check, serve `public/` with any static HTTP server and inspect `http://localhost:8889/` plus the relevant game page. The README lists the catalog, search, game launch, reload, and fullscreen behaviors to verify.
- Keep user-facing copy in Italian unless the surrounding page is intentionally using another language.