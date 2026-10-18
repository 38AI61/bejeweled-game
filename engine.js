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

module.exports = { createBoard, findMatches };