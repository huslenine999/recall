# Alg Trainer Build Plan — Square-1 EP & Megaminx PLL

Nov 8, 2026 · @Khuslen Gan-Ochir

## How to use this plan

Give Sonnet this plan plus both alg PDFs (Megaminx Full PLL sheet, Square-1 EP sheet), and have it work through the phases in order, stopping at each checkpoint.

1. Start a new chat with Sonnet. Attach both PDFs and this plan (export it as Markdown, or paste it).
2. Say: "Build this trainer following the plan. Do one phase at a time and stop at each checkpoint to show me the result."
3. Answer its checkpoint questions, then say "next phase".

The most important rule for Sonnet: **never trust the PDF text extraction.** Both sheets extract badly (page numbers glued onto algs, table cells merged). Every alg must be checked by a puzzle simulator before it is used for anything.

## Goal and deliverable

The deliverable is one self-contained HTML page, published as an artifact, with two tabs: **Megaminx PLL** and **Square-1 EP**. It must work equally well on a laptop (keyboard) and a phone (touch).

Core loop:

1. Pick a case from the user's selected set.
2. Show a setup scramble that creates that case on a solved puzzle.
3. User sets up, then solves with the timer.
4. Reveal the case name, a generated diagram, the alg(s), and the time.
5. Record the result and pick the next case.

Technical constraints:

- Plain HTML + CSS + JavaScript in one file, no build step. No external libraries are needed.
- All alg data lives inside the file as JSON.
- Diagrams are inline SVG, generated at runtime from the simulator (no image files).
- Browser storage is wrapped in try/catch, and the page must still run if storage is unavailable.

## Source data

Transcribe both PDFs into two JSON arrays embedded in the page. When the extracted text is unclear, render the PDF page as an image and read it visually.

### Megaminx Full PLL sheet (151 cases)

The sheet groups cases by James Macdiarmid's system. Each case has a name like `K1+`, `K1-`, `E3`, `M`, `W`, `D+`. The running counter at the bottom of each page (15, 26, 45 … 151) gives the totals to check against.

| Set | Letter groups | Cases | Running total |
| --- | --- | --- | --- |
| CPLL | A, E, K, H | 15 | 15 |
| EPLL | U, Z, Q | 11 | 26 |
| 3x1 Line | J, D, M, F | 19 | 45 |
| 2x2 Block | Y, W, V | 15 | 60 |
| R Block | B, R, P | 20 | 80 |
| 2x1s touching | N, C | 16 | 96 |
| 2x1s not touching | T, S | 19 | 115 |
| 2x1 | G, I | 16 | 131 |
| No blocks | L, X | 20 | 151 |

Known extraction problems to fix:

- Page numbers are glued onto algs: `4F R U' …` is `F R U' …`, `2R' U' …` is `R' U' …`, and `… D R3` ends with `R` (page 3). Leading digits 2–10 on an alg are page numbers.
- The A1- and A1+ algs start with `L-`. Check the PDF page visually. If it is not a move, drop it. The simulator check decides.
- Curly apostrophes (`’`) must be normalized to `'`.
- Repeats are written `(…)x2`, e.g. H1-: `(U R U R' U R' U' R2 U' R' U R' U R)x2`. Expand them.
- Algs contain `y`, `y'`, `F`, `L`, `D`, `dR`, `bR`, and double turns `R2` / `R2'` (144°).

Record per case: `{ id: "K1+", set: "CPLL", group: "K", alg: "R2' U2 R2 U …", fixes: ["removed page digit"] }`.

### Square-1 EP sheet

The table columns are: Parity Alg? · U · D · Alg without flip · Alg with flip · Probability (x/576) · Count.

- Each layer (U and D) has one of 10 edge-permutation states: `-` (solved), `cw U`, `ccw U`, `Z`, `H`, `Opp`, `Adj`, `cw O`, `ccw O`, `W`.
- A row is one U/D combination. Rows marked "Yes" are parity cases. The user wants both parity and non-parity cases.
- A cell can hold several alternative algs. The Count column says how many algs the row has in total. Use it to check that no alg was lost or merged.
- The extracted text merges the two alg columns. Do not guess which column an alg came from. Classify it with the simulator: an odd number of `/` slices means "with flip" (middle layer ends flipped), an even number means "without flip".
- Notes like "M2 U2 M2 and adj/adj" are annotations, not algs. Keep them as a `note` field.
- Normalize turn amounts into the range -5…6 (e.g. `1,7` → `1,-5`). Treat `//` as a boundary between two algs.

Record per row: `{ u: "Opp", d: "-", parity: true, algsNoFlip: [...], algsFlip: [...], prob: 8, note: "" }`.

**Checkpoint 1:** show the case counts per set and per row, and a list of every manual fix made. Wait for the user's OK.

## Puzzle engines

Build a small simulator for each puzzle. They are used three ways: to verify the algs, to draw the case diagrams, and to test the scrambles.

### Square-1 simulator

- State: the top layer and the bottom layer, 12 slots each (one slot = 30°). A corner fills 2 slots and an edge fills 1. Add a flag for the middle layer (square or flipped).
- Move `(a,b)`: rotate the top by `a` slots and the bottom by `b` slots.
- Move `/`: swap the right half (6 slots) of the top with the right half of the bottom, and toggle the middle-layer flag. It must throw an error if a corner straddles the cut. An illegal slice almost always means a transcription mistake.
- Parser: accept the sheet's style (`1,0 / -1,-1 / …`) and the WCA style with brackets `(1,0)/(-1,-1)/`.
- Turn direction convention (which way is positive for the top and the bottom): implement WCA regulation 12a. If unsure, try both conventions. The right one makes every alg on the sheet return to cube shape with all corners solved.

### Megaminx simulator

- Build it from 3D geometry rather than hand-written move tables. Compute the 12 face normals of a dodecahedron, place every sticker (center, edge, corner) as a 3D point, and turn a face by rotating every sticker on that side of the cutting plane 72° around its normal.
- Faces: U on top. F, R, BR, BL, L around it. Then the 5 lower faces and D.
- `y` rotates the whole puzzle 72° around the U axis.
- `R2` turns 144°. `R2'` turns -144°.
- `dR` and `bR` are face turns of the lower-right and back-right faces. If the naming is unclear, try the candidate faces. The right one is the one where the alg keeps everything outside the last layer solved.
- Compare states relative to the centers, because algs that contain `y` leave the whole puzzle rotated.

## Alg verification

Every alg runs through the simulator before it is used. Anything that fails goes into a report for the user, and is never silently "fixed" by guessing.

A case is defined as the state you get by applying the **inverse** of its alg to a solved puzzle. The alg then solves it.

### Megaminx checks (per alg)

1. It parses with no unknown tokens.
2. After the alg, everything outside the last layer is solved relative to the centers.
3. All U-colored stickers are still on the U face, so orientation is untouched.
4. The result is a pure permutation of the 5 last-layer corners and 5 last-layer edges.
5. Group results into cases "up to AUF": two states are the same case if they differ only by U turns before and after. No two different names may land in the same case.
6. Coverage: enumerate every possible last-layer permutation and count the cases up to AUF. The count should be 151 plus solved, matching the sheet. Every case must be covered by exactly one name.

### Square-1 checks (per alg)

1. Every slice is legal, and the alg ends in cube shape.
2. All corners end in their home slots, up to a final top or bottom turn.
3. Only edges move. Classify each layer's edge permutation, up to rotation of that layer, into the 10 states. Use one convention for cw/ccw so that all rows labeled `cw U` land in the same class. Report any row that disagrees.
4. Parity: `Opp`, `Adj`, `cw O`, `ccw O`, `W` are odd permutations, and `-`, `cw U`, `ccw U`, `Z`, `H` are even. A row should be marked "Yes" exactly when one layer is odd and the other is even.
5. The flip column must match the slice count (odd = with flip).
6. Every alg in a row produces the same case.

**Checkpoint 2:** show the report as a table with case · alg · pass/fail · reason. Target 100% pass. Give the user a short list of the algs to recheck against the PDF.

## Case diagrams

Diagrams are drawn by code from the simulated case state, so no case is drawn by hand. One drawing function per puzzle covers every case.

### Square-1

- Draw the top layer and the bottom layer side by side, seen from above. Label the bottom view "D (seen from below)" or "D (seen through the top)", choose one, and use it consistently.
- Draw each layer as 12 wedges: corners as kites (2 slots), edges as triangles. Fill them with the U/D color, and add a colored outer strip for each piece's side sticker so the permutation is readable.
- Draw arrows from each misplaced edge to where it belongs. Use one arrow style for 2-swaps and another for 3- and 4-cycles.
- Show a small badge for the middle layer: "square" or "flipped".

### Megaminx

- Draw a standard PLL diagram: the U face as a pentagon in a single color, with the side stickers of the 5 corners and 5 edges as a ring around it.
- Draw arrows for the cycles: solid for edges, dashed for corners.
- Colors come from a settings panel (12 face colors), with a common default scheme. PLL recognition depends on side colors, so the user must be able to match their own puzzle.

### Browse screen

Show a grid of every case with its diagram, name, and alg. It is useful for studying, and it is the quickest visual check that the diagrams are right.

**Checkpoint 3:** the user compares about 10 random diagrams with their real puzzles and the PDF.

## Setup scrambles

A setup is the inverse of the case's alg, wrapped in random layer turns so the same case doesn't always look identical.

### Megaminx

- Setup = random `U^a` + inverse(alg) + random `U^b`, where a and b are each one of none, `U`, `U2`, `U2'`, `U'`.
- Inverse: reverse the move list and invert each move (`R` ↔ `R'`, `R2` ↔ `R2'`, `y` ↔ `y'`, `dR` ↔ `dR'`). Expand `(…)x2` first.
- Remove rotations. If the inverse contains `y`, relabel the moves that follow it so the setup has no rotations.
- Merge adjacent U moves (mod 5) and drop moves that cancel.

### Square-1

- Setup = random `(a,b)` + inverse(alg) + random `(c,d)`, with each of a, b, c, d in {0, 3, 6, -3}.
- Inverse: reverse the token list, turn `(x,y)` into `(-x,-y)`, and keep `/` as it is.
- Merge adjacent `(x,y)` turns, normalize to -5…6, and drop `(0,0)`.
- Print it in the sheet's style: `1,0 / -1,-1 / …`.

### Display

- Show the scramble in a large monospace font, wrapped so it fits a 360 px wide phone screen.
- Tap or click to copy.

### Automated test

For every case and every random-wrapper combination, apply setup + alg to a solved puzzle. The result must be solved up to a final layer turn.

### Stretch goal: disguised setups

Build the setup from two other cases whose product equals the target (inverse(alg X) + U turn + inverse(alg Y)). The user then can't recognize the case from the scramble itself. This is cheap to compute with the permutation tables from verification.

## Trainer UI and modes

The page has three screens per puzzle tab: **Train**, **Cases** (selection and browse), and **Settings**.

### Case selection

- Megaminx: grouped by the 9 sets, then by letter group. Checkboxes at the case, group, and set level, plus select all / none.
- Square-1: grouped by U-layer state. Filters for Parity / No parity, and for which alg column to show (without flip, with flip, or both).
- Each case has a status chip the user taps to cycle: New → Learning → Learned.
- Quick filters: "Learning only" and "Not learned yet".

### Train screen

- Before the solve: the setup scramble and the timer.
- After the solve: the case name, its diagram, its alg(s) (Square-1 shows both the no-flip and the with-flip algs), and the time.
- Buttons: **Next**, **Forgot** (counts as a fail and raises the case's weight), **Again soon** (re-queues the case within the next 3–5 cases), **Delete last**.
- "Learning" setting: optionally show the diagram before the solve, so the user can study recognition while drilling the alg.

### Modes

- **Random:** weighted random pick (see Stats), never the same case twice in a row.
- **Recap:** every selected case once, in shuffled order, with a progress counter (e.g. "23 / 40").
- **Recognition quiz** (stretch goal): show a diagram and have the user pick the case name from 4 options.

## Timer (laptop and phone)

The timer works the same way on both devices: hold to arm, release to start, any input to stop.

|  | Laptop | Phone |
| --- | --- | --- |
| Arm | Hold Space for 0.3 s (timer turns green) | Hold the timer area for 0.3 s (turns green) |
| Start | Release Space | Lift your finger |
| Stop | Any key | Tap anywhere |
| Next case | Space or Enter after stopping | Tap the Next button |
| Forgot / Delete last | `F` / `Backspace` | Buttons |

Requirements:

- Use `performance.now()` and display `m:ss.cc`.
- On phones, the timer area covers at least 60% of the screen. Use `touch-action: none` and `preventDefault` on touch start, so holding doesn't scroll, zoom, or select text.
- Keep the screen awake during training with the Wake Lock API where it is supported.
- The layout works at 360 px wide in portrait, and uses two columns on wide screens (scramble and timer on the left, result and diagram on the right).
- Respect light and dark mode.

## Stats and storage

Keep stats per case and use them to bias Random mode toward slow, failed, and stale cases.

### Per-case data

- Status (New / Learning / Learned)
- The last 50 times
- Best, mean, ao5, ao12
- Fail count (Forgot presses)
- Last-seen timestamp

### Weighting in Random mode

weight = status base × slowness × fails × staleness

- Status base: Learning 3, New 2, Learned 1.
- Slowness: 1 + (case mean ÷ overall mean − 1), clamped to 0.5–3.
- Fails: 1 + 0.5 × fails in the last 10 attempts.
- Staleness: up to ×2 for cases not seen in the longest time.

Show each case's stats in the Cases screen, sortable by mean or by fails.

### Storage

- Use `localStorage` with a versioned schema and one key per puzzle, wrapped in try/catch.
- Artifact storage is per browser, so laptop and phone keep separate data. Add **Export** (download JSON) and **Import** (load JSON) buttons so the user can move progress between devices.
- Alg overrides: the user can edit a case's alg in the Cases screen. The edited alg is re-verified by the simulator before it is saved.

## Build order and acceptance checklist

Work in seven phases. Phases 1–3 make sure the algs are correct, and they are the ones that matter most. Phases 4–7 are the app around them.

1. **Data:** transcribe both PDFs to JSON. → Checkpoint 1
2. **Engines and verification:** both simulators plus the verification report. → Checkpoint 2
3. **Diagrams:** the drawing functions and the Browse grid. → Checkpoint 3
4. **Scrambles:** setup generation plus the automated setup + alg = solved test.
5. **Trainer UI and timer:** test on a real phone and a laptop.
6. **Stats and storage:** weighting, export / import.
7. **Stretch goals:** disguised setups, recognition quiz.

### Done when

- [ ] 151 Megaminx cases loaded, with the per-set counts matching the sheet.
- [ ] Square-1 alg counts per row match the sheet's Count column.
- [ ] 100% of algs pass verification, or every failure is listed for the user.
- [ ] Megaminx coverage check: 151 distinct cases, no duplicates.
- [ ] Square-1 parity labels agree with the parity rule on every row.
- [ ] Setup + alg = solved for every case, with random wrappers.
- [ ] Diagrams match the real puzzle on 10 spot-checked cases per puzzle.
- [ ] The timer works with Space on the laptop and with hold / tap on the phone, with no scrolling or zooming.
- [ ] Stats survive a page reload, and export / import moves them between devices.
- [ ] The layout works at 360 px wide and in dark mode.
