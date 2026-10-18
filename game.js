'use strict';
// Game state layer on top of the pure engine: score, moves, status, shuffle.

const { createBoard, canSwap, resolveBoard, hasValidMove, findMatches } = require('./engine.js');

function scoreFor(runLen) {
  if (runLen >= 6) return 150;
  if (runLen === 5) return 100;
  if (runLen === 4) return 60;
  return 30;
}

function createGame({ size = 8, colors = 6, moves = 30, rng = Math.random } = {}) {
  return {
    size,
    colors,
    rng,
    board: createBoard({ size, colors, rng }),
    movesLeft: moves,
    score: 0,
    status: 'playing',
  };
}

// Groups a cascade event's matched cells into maximal runs (L/T shapes count
// their horizontal and vertical arms separately) and scores each run.
function scoreEvent(e) {
  const inSet = new Set(e.positions.map(({ r, c }) => `${r},${c}`));
  const board = e.board;
  const key = (r, c) => `${r},${c}`;
  const counted = new Set();
  let gained = 0;
  for (const { r, c } of e.positions) {
    if (counted.has(key(r, c))) continue;
    const gem = board[r][c];
    const hCells = [[r, c]];
    for (let c2 = c - 1; c2 >= 0 && inSet.has(key(r, c2)) && board[r][c2] === gem; c2--) hCells.push([r, c2]);
    for (let c2 = c + 1; c2 < board[r].length && inSet.has(key(r, c2)) && board[r][c2] === gem; c2++) hCells.push([r, c2]);
    const vCells = [[r, c]];
    for (let r2 = r - 1; r2 >= 0 && inSet.has(key(r2, c)) && board[r2][c] === gem; r2--) vCells.push([r2, c]);
    for (let r2 = r + 1; r2 < board.length && inSet.has(key(r2, c)) && board[r2][c] === gem; r2++) vCells.push([r2, c]);
    const cells = hCells.length >= vCells.length ? hCells : vCells;
    for (const [rr, cc] of cells) counted.add(key(rr, cc));
    gained += scoreFor(cells.length);
  }
  return gained;
}

function trySwap(game, r1, c1, r2, c2) {
  if (game.status !== 'playing') return { ok: false, reason: 'game-over' };
  if (!canSwap(game.board, r1, c1, r2, c2)) return { ok: false, reason: 'invalid' };

  const swapped = game.board.map((row) => row.slice());
  swapped[r1][c1] = game.board[r2][c2];
  swapped[r2][c2] = game.board[r1][c1];

  let gained = 0;
  let cascades = 0;
  game.board = resolveBoard(swapped, {
    colors: game.colors,
    rng: game.rng,
    onClear: (e) => {
      gained += scoreEvent(e);
      cascades++;
    },
  });
  game.score += gained;
  game.movesLeft -= 1;
  if (game.movesLeft <= 0) game.status = 'over';
  if (!hasValidMove(game.board)) shuffleBoard(game, game.rng); // keep the board playable, free of charge
  return { ok: true, gained, cascades };
}

// Rearranges the existing gems until the board is playable (no matches, at
// least one valid move). Falls back to a fresh board if attempts run out.
function shuffleBoard(game, rng = Math.random) {
  const size = game.size;
  const flat = game.board.flat();
  for (let attempt = 0; attempt < 50; attempt++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    const board = [];
    for (let r = 0; r < size; r++) board.push(flat.slice(r * size, (r + 1) * size));
    if (findMatches(board).length === 0 && hasValidMove(board)) {
      game.board = board;
      return { ok: true, reshuffled: true };
    }
  }
  game.board = createBoard({ size, colors: game.colors, rng });
  return { ok: true, reshuffled: true, fresh: true };
}

module.exports = { createGame, trySwap, scoreFor, shuffleBoard };