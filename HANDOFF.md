# Recall (CubeTrainer): handoff (as of 2026-11-09)

A local, offline alg trainer for **Megaminx** and **Square-1** (PLL, EP, CSP and PBL so far), built because SpeedCubeDB's trainer is broken.
One self-contained HTML file, works on laptop and phone. Owner: hu$lenine (Megaminx sub-50, learning full PLL from
Raul Low Beattie's sheet; trains Square-1 EP).

Name: the site is called **Recall** (title, footer, export file `recall-progress.json`). The folder and repo keep the old name.
**Edit `src/`, never `dist/`:** `dist/index.html` is rebuilt from `src/` on every build, so changes made there are lost.

## Hosting

Deployed on Vercel from the GitHub repo. `vercel.json` tells Vercel to run `node build.js` and serve `dist/`.
Progress is stored in each browser's localStorage, so laptop and phone do not sync (use Settings > export/import).

## Run / build

- Open `dist/index.html` in a browser. It is fully offline (data, engines, app and fonts are inlined).
- Rebuild after editing anything in `src/` or `data/`: `node build.js` (plain Node, no dependencies).
- `build.js` fills four placeholders in `src/index.template.html`: `/*__FONTS__*/`, `/*__DATA__*/`,
  `/*__ENGINES__*/` (megaminx.js, square1.js, diagram.js, scramble.js), `/*__APP__*/` (app.js).

## Layout

| Path | What it is |
|---|---|
| `src/index.template.html` | Markup + all CSS (design tokens, light/dark, responsive) |
| `src/app.js` | UI, state, training logic, Cases screen, drawer editor, settings |
| `src/diagram.js` | SVG case diagrams generated from simulator state (Megaminx + Square-1) |
| `src/megaminx.js`, `src/square1.js` | Puzzle simulators / analysis (`M.run`, `M.analyze`, `S.caseState`, ...) |
| `src/scramble.js` | Builds the setup scramble from an alg (`mmSetup`, `sqSetup`) |
| `src/fonts/` | Bricolage Grotesque + Martian Mono (woff2, licences included) |
| `data/megaminx.json` | 151 PLL cases: `{id, set, alg, fixes}` |
| `data/square1_pbl.json` | 967 PBL cases: `{id, top, bot, layers, slices, alg, ct, cb}`; `top`/`bot` are the sheet's PLL-style names of the two layers, `ct`/`cb` the verified class of each layer's piece permutation |
| `data/square1_csp.json` | 179 CSP cases (90 cube shapes x even/odd): `{n, name, section, parity, alg, key}`; `key` is the shape (corner/edge pattern of both layers) the alg starts from |
| `data/square1_ep.json` | 99 EP rows: `{u, d, parity, algsNoFlip, algsFlip, prob, count, note}` (becomes 146 cases: no-flip + flip) |
| `data/verification_report.md`, `tools/` | Scripts used to parse the PDFs and verify every alg against the simulators |
| `backup-before-redesign/` | The original Sonnet build, before the redesign (reference only) |
| `Alg Trainer Build Plan ... .md` | The original build plan |

## Current state

**Sections** (top tabs "Megaminx" / "Square-1", plus a row of sets under them, defined by `SETS` in `app.js`):

- Megaminx: **PLL** (ready, 151 cases), **OLL** (empty, "soon")
- Square-1: **EP** (ready, 146 cases), **PBL** (ready, 967 cases), **CSP** (ready, 179 cases), **OBL** (empty, "soon")

Empty sets show a "No <puzzle> <set> algs yet" screen; keyboard shortcuts are disabled there. Settings works on every set.
The last chosen set per puzzle is remembered.

**Screens per set:** Train (scramble, hold-Space timer, reveal, Forgot / Again soon / Delete last, weighted random or
recap mode, session list), Cases (filter chips, "Select cases" menu, sort, whole card toggles the case, Edit drawer with
live diagram preview), Settings (theme, show diagram, Megaminx sticker colours, export/import, reset).

**Diagrams (generated, never hand-drawn):**

- Megaminx: U face as on Macdiarmid's sheet: rounded pentagon centre, 5 edge pieces (narrow at the rim, wide at the
  centre), 5 kite corners on a black body, a seamless mitred ring of side stickers (edge sticker wide on the outside),
  optional thin yellow arrows (double-headed = swap, curved = 3-cycle); **arrows are off by default** (Settings > "Show arrows on Megaminx cases", `settings.mmArrows`) because the user found them confusing. The coloured "petals" outside the ring were removed on
  request (the sheet's E3 picture has them, so they may be wanted back). Default sticker colours are sampled from the
  sheet (soft/pastel); the user can change them in Settings, and saved colours override defaults.
- Square-1: two square layers **side by side**, U on the left (dark pieces), D on the right drawn as seen from below
  (mirrored, white pieces), each with a red slice line, headings "U top layer" / "D bottom layer", and a
  "middle square / middle flipped" badge. Saturated colours: top layer clockwise from the right side is green, red,
  blue, orange. A dark wedge in D (or white in U) means a piece of the other layer is sitting there. Yellow arrows
  (with a dark outline) mark misplaced edges. Square-1 colours are fixed (not in Settings).
- Case images have a **transparent background** (they sit on the card), text uses the theme colour.

- Square-1 slice marker: a thin, semi-transparent red line drawn *behind* the pieces, so it only shows as a tick above and below each layer
  (it used to be a thick line over the cube and the user found it too loud).
- Square-1 CSP: the same two-layer frame and the same piece/sticker-ring drawing as EP (`sqLayer`, which now draws any layer shape: edges are
  30 degree wedges, corners 60 degree kites), but colourless (`CSP_LOOK` in `diagram.js`): dark U pieces, white D pieces, grey stickers.
  The badge shows whether the middle layer is flipped.
- Square-1 PBL (`pblDiagram`): cube shape with every piece coloured, no arrows, no middle-layer badge. Each layer is turned to whichever of its
  four positions leaves the most pieces at home (the case is the same up to turning a layer).
  Even and odd of one shape look the same apart from that badge; the case title says which one it is.

**Storage (localStorage keys):** `at.mm.v1`, `at.sq.v1`, `at.csp.v1`, `at.pbl.v1` (selection, status, times, alg edits), `at.settings.v1`,
`at.colors`, `at.sets.v1` (last set per puzzle). Export/import in Settings covers mm, sq, csp, pbl and settings (older exports without csp/pbl still import).

## Internals worth knowing

- Internally there are four data keys: `'mm'` (Megaminx PLL), `'sq'` (Square-1 EP), `'csp'` and `'pbl'` (Square-1 CSP and PBL). `ui.puzzle` is the tab
  (`'mm'` or `'sq'`); `dk()` in `app.js` gives the data key for what is on screen (`'csp'` / `'pbl'` when Square-1 is on that set). Everything that
  touches cases, stats, diagrams or scrambles goes through `dk()`. `ready()` is true for PLL, EP, CSP and PBL.
- **Adding OLL / OBL is more than adding data.** It needs per-set case lists, db keys and stats (follow what CSP did: a new data
  key in `KEYS`, `DATA_*` in `build.js`, a branch in `verifyAlg`, `diagSvg`, `viewCases`, `previewOne`, and a setup function in
  `scramble.js`). `sqLayer` draws any layer shape (OBL can use it, with its own sticker colours), and
  OLL needs a Megaminx orientation diagram (PLL diagrams show permutation arrows).
- **CSP specifics.** The sheet's algs go from a shape to a cube shape, so the case is read off the *reversed* alg: `S.cspState(alg, key)` runs
  `invert(alg)` from a solved cube with a layer pre-turn that keeps every slice legal (turns of 3 slots, or offset by 1 for odd cases), and
  `S.shapeKey` gives the corner/edge pattern of both layers. Some algs fit two shapes from different pre-turns, so the stored `key` picks the
  labelled one. `X.cspSetup` builds the scramble (random whole-cube spin, then the reversed alg; no wrapper after it, since a turn there would
  change the start position the alg expects). In the sheet's names the bottom layer is seen from below, so left/right of pawns and fists are
  swapped for the second word. Star odd algs are `0,2` + the even alg; "square square" has only an odd alg; "kite kite" odd is a single slice.
  Run `node tools/verify_csp.js` after any change to the data or the simulator (checks all 179 cases and 20 scrambles each).
- Per-set data should follow the existing pattern: parse the sheet, verify every alg against the simulator
  (`tools/verify_*.js`), then build the cases.
- A tile click is handled in `wireCases()` (delegated on `.tiles`); the visually hidden checkbox keeps it keyboard
  accessible. The Edit and status buttons stop it from toggling.

## Decisions and history

- Redesigned the whole UI (dark/light, mobile bottom nav, measured sticky header, container-query timer sizing).
- Diagram style was iterated against the user's pictures: the sheet (E1/E3) for Megaminx and a hand-drawn reference for
  Square-1. A photo of the real puzzles (round Megaminx centre) was tried and rejected in favour of the sheet's look.
- Megaminx colours stay on the sheet's soft palette; only Square-1 was made saturated. Ask before changing Megaminx.
- Square-1 "D" is deliberately mirrored (seen from below) to match the reference.

## Known gaps / next steps

1. User will send the **OLL** (Megaminx) and **OBL** (Square-1) algorithms. Build each set (see above).
   The CSP data came from the user's "Squanmate cube shape + parity" PDF (text pulled with `pdftotext -bbox-layout`, algs assigned to case and
   even/odd by their column position; the sheet's tips and notes are not included).
2. (Fixed) On phones the revealed answer now sits right under a compact timer, with Next pinned above the nav bar.
3. Square-1 colours are not customisable yet.
4. No automated tests for the UI; verification is by the scripts in `tools/` and Playwright screenshots.

## Working notes for the next session

- Edit in a scratch copy, `node build.js`, test with Playwright, then copy to the project folder and rebuild there.
- When copying files to the user's machine via the file-staging tool, wait a few seconds after the copy and compare
  checksums (`md5sum`) of the source and the destination, because an early commit once wrote stale content.
- Git: local repo on `main`, remote `origin` = https://github.com/huslenine999/algtrainer.git. The first push has NOT happened yet:
  the cloud session had no GitHub credentials. Push from a terminal in this folder: `git push -u origin main`.

## PBL notes (Daniel's public PBL doc, .xlsx)

- Source: the "Raw Algs" sheet has one alg per (top layer, bottom layer) pair in plain `a,b/` notation (the Karnaukh-notation letter sheets are
  not needed). 22 PLL-style names per layer x 22 x 2 (both layers "even" or both "odd") = 968 rows; minus the solved cube = 967 cases.
  One row, **M / Db, was blank** in the sheet; its alg is the Db / M alg with the two layers swapped (`a,b` -> `b,a`), verified like the others.
- A PBL alg starts from a cube shape, so the case state is `S.cspState(alg)` (inverse alg run from a solved cube); `S.pblClass(state)` gives each
  layer's piece-permutation class up to turning that layer. `node tools/verify_pbl.js` checks all 967: legal, cube shape, pieces stay in their
  layer, class matches the stored `ct`/`cb`, 44 names <-> 44 classes per layer one to one, and scramble + alg solves the cube.
- The Cases screen shows PBL 90 tiles at a time ("Show more") because drawing 967 diagrams at once is slow; filters are slice-count chips plus
  Top / Bottom name selects. Scrambles use `X.cspSetup` (random whole-cube spin, then the reversed alg), so the user has to AUF/DUF into the alg.

## Train flow (continuous, cstimer-style)

- Hold Space (or the timer on a phone), let go to start, any key / tap stops. Stopping records the solve and the **next case is shown at once**;
  the previous case, its algs and stats are hidden. The timer keeps the last time until the next solve starts (`run.time`).
- The rail shows only the case picture of what is being solved (`settings.showCase`, default on; replaces the old `settings.preview` study mode).
- "I forgot it: show answer" (F) records a fail and opens the answer panel; Space / Next goes on. "Undo forgot" lets you try that case again.
- Under the buttons a "last solve" row shows the previous case's name and time with Show alg (`ui.peek` toggles a panel for it), Again soon and Delete.
- Shortcuts, matched by `e.code` (Option+Z types a symbol on a Mac): Alt/Option+Z delete last solve (`doUndo`; also Backspace), Alt/Option+D reset the
  session (`resetSession`; clears only this visit's list, each case's saved stats stay), Alt/Option+3 mark the last solve as forgot (cstimer's DNF key).
  The label is the Option sign on Apple platforms and `Alt+` elsewhere (`MOD`). They are listed in Settings and under the Train buttons (hidden on touch).
- `sess[dk()]` is the single source for the last solve and for undo: each entry is `{id, time|null}`; deleting pops the entry and reverses the case stat.
- A tap that stops the timer must not start the next hold: `ptrStopped` guards the `#timer` pointerdown.
- Phone (<= 860px): `.train` is a flex column (`display:contents` on `.stage`/`.rail`), ordered stage bar -> scramble -> timer -> case picture ->
  buttons -> last-solve row -> peeked case -> session. After "show answer" it becomes time -> answer -> Next (sticky above the nav bar) -> session.
- Session panel: Solved, Forgot, Mean, Best, Ao5, Ao12 (`aoText` in `app.js`: drop best and worst, a forgotten case counts as the worst, two or more forgotten = DNF).
- Square-1 scrambles use a smaller font (`.scramble.sq`) so they fit in fewer lines.

## Performance notes

- Startup checks only the set on screen (`ensure(dk())` in `render`/`nextCase`); the other sets are checked a few cases at a time in idle time
  (`warm`, `requestIdleCallback`). `checked[p]` counts how far each set is; import resets it to 0.
- Cases cards use `content-visibility:auto` so off-screen cards are not laid out or painted. Card clicks (select, status, Edit) go through one
  delegated listener on `.tiles`; a status change replaces only that card's HTML.
- `--top-h` / `--nav-h` come from ResizeObservers (no forced layout on render). Avoid reading layout (getBoundingClientRect, scrollLeft) in render.
- Fonts are subset to ASCII plus a few symbols (copyright sign, middle dot, dashes, curly quotes) with
  `pyftsubset <font> --unicodes="U+0020-007E,U+00A9,U+00B7,U+2013,U+2014,U+2019,U+201C,U+201D" --layout-features='*' --flavor=woff2`.
  If new UI text uses another non-ASCII character, add it there and re-subset from the original Google Fonts files.
- build.js drops unused data fields and embeds each set as `JSON.parse('...')`.

## Offline app, Square-1 colours, preferred algs

- **PWA.** `build.js` writes `dist/manifest.webmanifest`, copies `src/icons/*` and writes `dist/sw.js` from `src/sw.js` (cache name `recall-<hash of the built html>`,
  so every build replaces the old cache). Navigations are served from the cache and refreshed in the background, so a new version shows up on the
  next open (a toast says so). `app.js` registers `sw.js` only on http(s). Settings has an Offline group (status text, Install button on Chrome/Android).
  Icons are generated by `node tools/make_icons.js` (needs Playwright); the PNGs are committed in `src/icons/`. `vercel.json` sends `sw.js` with no-cache.
  Test: serve `dist/` over http, load once, go offline, reload.
- **Square-1 colours.** `sqColors` ({face, faceD, sides[4]}, `at.sqcolors`) feed `square1Diagram` and `pblDiagram`; CSP stays neutral. Included in export/import.
- **Preferred alg.** `db[p].pref[caseId] = alg text`. `prefAlg(p, c)` returns it while it is still one of the case's checked algs. It is used for the scramble
  (`newRound`), the diagram, and the order of the alg lists (`algsHtml`: starred first, others dimmed). The star only shows when a case has two or more checked algs;
  clicking it again clears the choice. Stored with each puzzle's data, so it is exported too.

## Megaminx OLL
- Data: `data/megaminx_oll.json` (257 cases, 649 algs, from SpeedcubeQuest's PDF). `cls` is the case's sticker pattern (up to AUF), computed by `Megaminx.ollPattern`.
- Data key `oll`. An alg passes when F2L is solved by it and its case class equals the case's `cls`.
- Diagram: `Diagram.megaminxOllDiagram` (yellow = U colour, dark = not).
- Left out because the PDF text was garbled: 2B third alg, 10B- second alg (lowercase f).
- Alg AUFs were re-aligned (68 algs) so every alg of a case starts from the same picture.

## Trigger marks
- Settings: Trigger marks (Boxes / Brackets / Off, default Boxes) and Show trigger names. `chunks()` and `algText()` in app.js.
- Megaminx: dictionary TRIGS (sune, antisune, sexy, sledge, hedgeslammer), longest match first, other moves left plain. Square-1: each turn between slashes.
- Not done: typing your own brackets in the Edit drawer; per-move fingertrick notes; the PDF's own trigger groups (its box layout is too garbled to read reliably).
