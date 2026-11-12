# Recall

An alg trainer for **Megaminx** (PLL, OLL) and **Square-1** (EP, PBL, CSP). It shows a scramble that sets up one case,
times the solve cstimer-style, and brings back the cases you forget more often. Every alg is checked against a puzzle
simulator, and the case pictures are drawn from the simulator state.

It builds to one self-contained HTML file: no framework, no dependencies, works offline, installs as an app.

## Quick start

You need Node 18 or newer. Nothing to install.

```
npm run dev      # build, serve http://localhost:5173, rebuild + reload on every save
npm test         # build, then verify the algs and scrambles against the simulators
npm run build    # just write dist/
```

`npm run dev` also prints an address for your phone on the same wifi.
To use the app without a server, open `dist/index.html` in a browser.

The browser test clicks through the real page (first visit, a timed solve, every set, search, editor, Back, phone layout).
It needs Playwright once: `npm i -D playwright && npx playwright install chromium`, then `npm run test:ui`.

## Where things are

| Path | What it is |
|---|---|
| `src/index.template.html` | Markup and all CSS (colour tokens, light/dark, phone layout) |
| `src/app.js` | Screens, state, timer, training logic, settings, sync |
| `src/megaminx.js`, `src/square1.js` | Puzzle simulators and case analysis |
| `src/diagram.js` | SVG case diagrams, drawn from simulator state |
| `src/scramble.js` | Builds the setup scramble for an alg |
| `src/palettes.js`, `src/sw.js` | Colour palettes; service worker for offline use |
| `data/*.json` | The alg sheets, one file per set |
| `api/sync.js` | Optional sync function (Vercel + Upstash Redis) |
| `build.js` | Inlines fonts, data and scripts into `dist/index.html` |
| `tools/` | Dev server, tests, and the scripts that parsed and verified the sheets |

**Edit `src/` and `data/`, never `dist/`**: `dist/` is rewritten by every build.

`HANDOFF.md` has the detailed design notes: how each diagram is drawn, what each set needed, and why things are the way they are.

## Common jobs

- **Change an alg in a sheet**: edit the file in `data/`, then `npm test`. A wrong alg shows up as a problem in the
  verify step, and in the app as a red "check" card.
- **Add a set**: follow the "Adding OLL / OBL" notes in `HANDOFF.md` (data key, `build.js`, `verifyAlg`, diagram, scramble).
- **Add UI text with a new symbol**: the fonts are subset; see "Performance notes" in `HANDOFF.md`.

## Deploying

Vercel runs `node build.js` and serves `dist/` (see `vercel.json`). Pushing to `main` deploys.
GitHub Actions runs `npm test` on every push (`.github/workflows/ci.yml`).

Sync is optional. To turn it on, connect Upstash Redis to the Vercel project (Storage > Upstash for Redis);
without it the Sync section says it is not set up and everything else works.

## Credits

Algorithms come from the cubing community: Raul Low Beattie's Megaminx PLL sheet (James Macdiarmid's case system),
SpeedcubeQuest's Megaminx OLL, Daniel's Public PBL Doc and the Squanmate cube shape + parity sheet.
Fonts: Bricolage Grotesque and Martian Mono (licences in `src/fonts/`).
