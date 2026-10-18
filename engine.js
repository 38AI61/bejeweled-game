'use strict';
// Bejeweled match-3 engine (pure logic, no DOM).
(function () {

function createBoard({ size, colors, rng = Math.random }) {
  const board = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      let gem;
      let attempts = 0;
      // A degenerate rng (constant output) would block the same gem forever,
      // so retries are capped and a varying fallback fill takes over.
      do {
        gem = attempts < 20 ? Math.floor(rng() * colors) : (r * size + c + attempts) % colors;
        attempts++;
      } while (
        attempts <= 20 &&
        ((c >= 2 && row[c - 1] === gem && row[c - 2] === gem) ||
          (r >= 2 && board[r - 1][c] === gem && board[r - 2][c] === gem))
      );
      row.push(gem);
    }
    board.push(row);
  }
  // The anti-match fill can still produce a dead board; repair it in place.
  if (!hasValidMove(board)) {
    const r = rearrangePlayable(board, rng);
    if (r.ok) return r.board;
  }
  return board;
}

function findMatches(board) {
  const size = board.length;
  const matched = new Set();
  const key = (r, c) => `${r},${c}`;

  // Horizontal runs of 3+
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 2; c++) {
      const gem = board[r][c];
      if (gem === null) continue;
      let end = c + 1;
      while (end < size && board[r][end] === gem) end++;
      if (end - c >= 3) {
        for (let k = c; k < end; k++) matched.add(key(r, k));
        c = end - 1;
      }
    }
  }
  // Vertical runs of 3+
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size - 2; r++) {
      const gem = board[r][c];
      if (gem === null) continue;
      let end = r + 1;
      while (end < size && board[end][c] === gem) end++;
      if (end - r >= 3) {
        for (let k = r; k < end; k++) matched.add(key(k, c));
        r = end - 1;
      }
    }
  }
  return [...matched].map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { r, c };
  });
}

function canSwap(board, r1, c1, r2, c2) {
  const size = board.length;
  const inBounds = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
  if (!inBounds(r1, c1) || !inBounds(r2, c2)) return false;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
  const swapped = board.map((row) => row.slice());
  swapped[r1][c1] = board[r2][c2];
  swapped[r2][c2] = board[r1][c1];
  return findMatches(swapped).length > 0;
}

function resolveGravity(board, { colors, rng = Math.random }) {
  const size = board.length;
  const cols = board[0].length;
  const stackPerCol = Array.from({ length: cols }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < cols; c++) {
      const gem = board[r][c];
      if (gem !== null) stackPerCol[c].push(gem);
    }
  }
  const result = [];
  for (let r = 0; r < size; r++) result.push(new Array(cols));
  for (let c = 0; c < cols; c++) {
    const stack = stackPerCol[c];
    const missing = size - stack.length;
    const refills = [];
    for (let i = 0; i < missing; i++) refills.push(Math.floor(rng() * colors));
    const column = refills.concat(stack); // refills at top, survivors sink to bottom
    for (let r = 0; r < size; r++) result[r][c] = column[r];
  }
  return result;
}

function hasValidMove(board) {
  const size = board.length;
  const cols = board[0].length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && canSwap(board, r, c, r, c + 1)) return true;
      if (r + 1 < size && canSwap(board, r, c, r + 1, c)) return true;
    }
  }
  return false;
}

const MAX_CASCADES = 100; // degenerate-rng safety: stop instead of looping forever

function resolveBoard(board, { colors, rng = Math.random, onClear = null }) {
  let current = board.map((row) => row.slice());
  let cascade = 0;
  for (;;) {
    const matches = findMatches(current);
    if (matches.length === 0 || cascade >= MAX_CASCADES) break;
    const cleared = current.map((row) => row.slice());
    for (const { r, c } of matches) cleared[r][c] = null;
    const after = resolveGravity(cleared, { colors, rng });
    if (onClear) onClear({ positions: matches, cascade, board: current, after });
    current = after;
    cascade++;
  }
  return current;
}

// Rearranges the EXISTING gems (exact multiset preserved) into a playable,
// match-free board. Greedy placement avoids runs while consuming the pool;
// pairwise swaps repair deadness. Returns { ok, board }.
function rearrangePlayable(board, rng = Math.random) {
  const size = board.length;
  const cols = board[0].length;
  const counts = new Map();
  for (const gem of board.flat()) counts.set(gem, (counts.get(gem) || 0) + 1);
  const colorsList = [...counts.keys()];
  const avail = (g) => (counts.get(g) || 0) > 0;
  const take = (g) => counts.set(g, counts.get(g) - 1);

  const placed = [];
  for (let r = 0; r < size; r++) placed.push(new Array(cols));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < cols; c++) {
      const forbidden = new Set();
      if (c >= 2 && placed[r][c - 1] === placed[r][c - 2]) forbidden.add(placed[r][c - 1]);
      if (r >= 2 && placed[r - 1][c] === placed[r - 2][c]) forbidden.add(placed[r - 1][c]);
      let options = colorsList.filter((g) => avail(g) && !forbidden.has(g));
      if (options.length === 0) options = colorsList.filter(avail);
      if (options.length === 0) return { ok: false, board: null };
      const gem = options[Math.floor(rng() * options.length)];
      take(gem);
      placed[r][c] = gem;
    }
  }
  // Repair leftover matches: swap a matched gem with the first cell (reading
  // order) holding a different color. Deterministic -> robust under any rng.
  let guard = 0;
  const cells = size * cols;
  while (findMatches(placed).length > 0 && guard++ < 500) {
    const m = findMatches(placed)[0];
    let fixed = false;
    for (let i = 0; i < cells && !fixed; i++) {
      const r2 = Math.floor(i / cols);
      const c2 = i % cols;
      if ((r2 === m.r && c2 === m.c) || placed[m.r][m.c] === placed[r2][c2]) continue;
      const a = placed[m.r][m.c];
      const b = placed[r2][c2];
      placed[m.r][m.c] = b;
      placed[r2][c2] = a;
      if (findMatches(placed).length === 0) fixed = true;
      else {
        placed[m.r][m.c] = a;
        placed[r2][c2] = b;
      }
    }
    if (!fixed) break;
  }
  // Repair deadness: deterministic sweep over same-color pair swaps; the first
  // swap that yields a match-free board with a valid move wins.
  outer: for (let i = 0; i < cells; i++) {
    for (let j = i + 1; j < cells; j++) {
      const r1 = Math.floor(i / cols);
      const c1 = i % cols;
      const r2 = Math.floor(j / cols);
      const c2 = j % cols;
      if (placed[r1][c1] === placed[r2][c2]) continue;
      const a = placed[r1][c1];
      const b = placed[r2][c2];
      placed[r1][c1] = b;
      placed[r2][c2] = a;
      if (findMatches(placed).length === 0 && hasValidMove(placed)) break outer;
      placed[r1][c1] = a;
      placed[r2][c2] = b;
    }
  }
  if (findMatches(placed).length > 0 || !hasValidMove(placed)) return { ok: false, board: placed };
  return { ok: true, board: placed };
}

const api = { createBoard, findMatches, canSwap, resolveGravity, hasValidMove, resolveBoard, rearrangePlayable };
// UMD: works as a CommonJS module (node --test) and as a browser global.
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.Engine = api;

})();