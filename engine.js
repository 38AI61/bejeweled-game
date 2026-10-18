'use strict';
// Bejeweled match-3 engine (pure logic, no DOM).

function createBoard({ size, colors, rng = Math.random }) {
  const board = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      let gem;
      do {
        gem = Math.floor(rng() * colors);
      } while (
        (c >= 2 && row[c - 1] === gem && row[c - 2] === gem) ||
        (r >= 2 && board[r - 1][c] === gem && board[r - 2][c] === gem)
      );
      row.push(gem);
    }
    board.push(row);
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

module.exports = { createBoard, findMatches, canSwap, resolveGravity, hasValidMove };