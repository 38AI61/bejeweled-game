# Bejeweled — Thunder Agent

A simple, polished match-3 ("Bejeweled") game. Pure vanilla JavaScript — no
dependencies, no build step.

## Play

```bash
cd bejeweled-game
python3 -m http.server 8377
# open http://127.0.0.1:8377/index.html
```

(Opening `index.html` directly from disk also works — no modules or fetches.)

### Rules

- Swap two adjacent gems (click one, then an adjacent one — or drag).
- Lines of 3+ identical gems clear from the board.
- Gems fall down, new ones drop in; chain reactions ("cascades") score
  bonus-multiplied points.
- You have 30 moves. When no valid swap remains, the board reshuffles itself
  automatically (and the Shuffle button always reshuffles for free).

### Scoring

| Run length | Points |
|-----------|--------|
| 3         | 30     |
| 4         | 60     |
| 5         | 100    |
| 6+        | 150    |

Each cascade step scores its own runs, so a single move can pay out repeatedly.

## Project layout

```
engine.js        Pure match-3 logic: board creation (match-free AND playable
                 guaranteed), match detection, swap validity, gravity/refill,
                 cascade resolution. No DOM. UMD (Node + browser).
game.js          Game state: score, moves, status, scoring formula, shuffle.
                 UMD (Node + browser).
app.js           Browser UI: rendering, input (click + drag), animations.
index.html       Page + styles (dark theme, six shape+color gem types).
tests/           node:test suites for engine.js and game.js.
scripts/         One-off probes (e.g. dead-board search used to find test data).
```

## Tests

33 tests, strict TDD (each written and watched failing before its
implementation):

```bash
node --test tests/
```

Coverage highlights: run detection (horizontal/vertical/L-T/5+), swap
validity (bounds, adjacency, no-match rejection), gravity/refill order,
cascade looping with event callbacks (pre-clear board + post-gravity board),
scoring, game-over freezing, dead-board detection and repair (multiset-
preserving rearrangement), and termination under degenerate constant rngs.

## Guarantees baked into the engine

- `createBoard` never returns a board with pre-existing matches — and never
  returns a *dead* board (it repairs match-free-but-unplayable fills).
- `resolveBoard` terminates even if the rng degenerately re-creates matches.
- `rearrangePlayable` preserves the exact gem multiset while restoring
  playability.