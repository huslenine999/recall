# CubeTrainer: handoff (as of 2026-11-09)

A local, offline alg trainer for **Megaminx** and **Square-1**, built because SpeedCubeDB's trainer is broken.
One self-contained HTML file, works on laptop and phone. Owner: hu$lenine (Megaminx sub-50, learning full PLL from
Raul Low Beattie's sheet; trains Square-1 EP).

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
| `data/square1_ep.json` | 99 EP rows: `{u, d, parity, algsNoFlip, algsFlip, prob, count, note}` (becomes 146 cases: no-flip + flip) |
| `data/verification_report.md`, `tools/` | Scripts used to parse the PDFs and verify every alg against the simulators |
| `backup-before-redesign/` | The original Sonnet build, before the redesign (reference only) |
| `Alg Trainer Build Plan ... .md` | The original build plan |

## Current state

**Sections** (top tabs "Megaminx" / "Square-1", plus a row of sets under them, defined by `SETS` in `app.js`):

- Megaminx: **PLL** (ready, 151 cases), **OLL** (empty, "soon")
- Square-1: **EP** (ready, 146 cases), **PBL**, **OBL**, **CSP** (all empty, "soon")

Empty sets show a "No <puzzle> <set> algs yet" screen; keyboard shortcuts are disabled there. Settings works on every set.
The last chosen set per puzzle is remembered.

**Screens per set:** Train (scramble, hold-Space timer, reveal, Forgot / Again soon / Delete last, weighted random or
recap mode, session list), Cases (filter chips, "Select cases" menu, sort, whole card toggles the case, Edit drawer with
live diagram preview), Settings (theme, show diagram, Megaminx sticker colours, export/import, reset).

**Diagrams (generated, never hand-drawn):**

- Megaminx: U face as on Macdiarmid's sheet: rounded pentagon centre, 5 edge pieces (narrow at the rim, wide at the
  centre), 5 kite corners on a black body, a seamless mitred ring of side stickers (edge sticker wide on the outside),
  thin yellow arrows (double-headed = swap, curved = 3-cycle). The coloured "petals" outside the ring were removed on
  request (the sheet's E3 picture has them, so they may be wanted back). Default sticker colours are sampled from the
  sheet (soft/pastel); the user can change them in Settings, and saved colours override defaults.
- Square-1: two square layers **side by side**, U on the left (dark pieces), D on the right drawn as seen from below
  (mirrored, white pieces), each with a red slice line, headings "U top layer" / "D bottom layer", and a
  "middle square / middle flipped" badge. Saturated colours: top layer clockwise from the right side is green, red,
  blue, orange. A dark wedge in D (or white in U) means a piece of the other layer is sitting there. Yellow arrows
  (with a dark outline) mark misplaced edges. Square-1 colours are fixed (not in Settings).
- Case images have a **transparent background** (they sit on the card), text uses the theme colour.

**Storage (localStorage keys):** `at.mm.v1`, `at.sq.v1` (selection, status, times, alg edits), `at.settings.v1`,
`at.colors`, `at.sets.v1` (last set per puzzle). Export/import in Settings covers mm, sq and settings.

## Internals worth knowing

- Internally the data key is `'mm'` (= Megaminx PLL) and `'sq'` (= Square-1 EP). `ui.puzzle` is that key; `ui.set[...]`
  only decides which *view* is shown. `ready()` is true only for PLL and EP.
- **Adding OLL / PBL / OBL / CSP is more than adding data.** It needs per-set case lists, db keys and stats, a
  setup/scramble function, an analyzer, and diagram support. In particular `sqLayer` in `diagram.js` assumes cube
  shape (4 corners + 4 edges forming a square), so PBL/OBL/CSP with other shapes need a generalised rim, and OLL needs
  a Megaminx orientation diagram (PLL diagrams show permutation arrows).
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

1. User will send the **OLL** (Megaminx) and **PBL, OBL, CSP** (Square-1) algorithms. Build each set (see above).
2. On phones the revealed answer for Square-1 sits below the timer and needs a scroll.
3. Square-1 colours are not customisable yet.
4. No automated tests for the UI; verification is by the scripts in `tools/` and Playwright screenshots.

## Working notes for the next session

- Edit in a scratch copy, `node build.js`, test with Playwright, then copy to the project folder and rebuild there.
- When copying files to the user's machine via the file-staging tool, wait a few seconds after the copy and compare
  checksums (`md5sum`) of the source and the destination, because an early commit once wrote stale content.
- Git: this folder was not a repository before this handoff. It has been initialised with one commit and **no remote**.
  Add a remote and push: `git remote add origin <url> && git push -u origin main`.
