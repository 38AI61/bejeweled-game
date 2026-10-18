'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createGame, trySwap } = require('../game.js');

// Deterministic rng helper (fresh copy per test).
function makeRng(values) {
  let i = 0;
  return () => values[i++] ?? 0.99;
}

test('createGame initializes an 8x8 board, full moves, zero score, playing status', () => {
  const game = createGame({ size: 8, colors: 6, moves: 30 });
  assert.strictEqual(game.size, 8);
  assert.strictEqual(game.colors, 6);
  assert.strictEqual(game.movesLeft, 30);
  assert.strictEqual(game.score, 0);
  assert.strictEqual(game.status, 'playing');
  assert.strictEqual(game.board.length, 8);
  assert.strictEqual(game.board[0].length, 8);
  assert.ok(game.board.every((row) => row.every((g) => g !== null && Number.isInteger(g))));
});

test('trySwap on an invalid swap keeps board, score and movesLeft unchanged', () => {
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 20, rng });
  const before = JSON.stringify(game.board);
  const result = trySwap(game, 0, 0, 0, 2); // far apart -> invalid
  assert.strictEqual(result.ok, false);
  assert.strictEqual(JSON.stringify(game.board), before, 'board must not change');
  assert.strictEqual(game.score, 0);
  assert.strictEqual(game.movesLeft, 20);
});

test('trySwap on a valid swap decrements movesLeft and awards score', () => {
  // A tiny deterministic board with a guaranteed valid swap:
  // [0,1,1,1] -> swapping (0,3) with (1,3) puts gem 0 at (0,3): row0 = [0,1,1,0]? no run.
  // Simplest deterministic trick: build via createGame then locate a valid move
  // by scanning with the engine, using it for the swap.
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 20, rng });
  const { hasValidMove, canSwap } = require('../engine.js');
  let move = null;
  outer: for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (c + 1 < 6 && canSwap(game.board, r, c, r, c + 1)) { move = [r, c, r, c + 1]; break outer; }
      if (r + 1 < 6 && canSwap(game.board, r, c, r + 1, c)) { move = [r, c, r + 1, c]; break outer; }
    }
  }
  assert.ok(move, 'created board must have at least one valid move');
  const result = trySwap(game, ...move);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(game.movesLeft, 19);
  assert.ok(game.score > 0, 'score must increase');
  assert.ok(game.board.every((row) => row.every((g) => g !== null)), 'board must be refilled');
});

test('scoreFor grows superlinearly with run length', () => {
  const { scoreFor } = require('../game.js');
  assert.strictEqual(scoreFor(3), 30);
  assert.strictEqual(scoreFor(4), 60);
  assert.strictEqual(scoreFor(5), 100);
  assert.strictEqual(scoreFor(6), 150);
  assert.ok(scoreFor(4) > scoreFor(3));
  assert.ok(scoreFor(5) > scoreFor(4));
});

test('game ends when movesLeft hits 0 (status won/over) and no swap is accepted after', () => {
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 1, rng });
  const { canSwap } = require('../engine.js');
  let move = null;
  outer: for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (c + 1 < 6 && canSwap(game.board, r, c, r, c + 1)) { move = [r, c, r, c + 1]; break outer; }
      if (r + 1 < 6 && canSwap(game.board, r, c, r + 1, c)) { move = [r, c, r + 1, c]; break outer; }
    }
  }
  assert.ok(move, 'must have one move to play');
  const result = trySwap(game, ...move);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(game.movesLeft, 0);
  assert.strictEqual(game.status, 'over');
  const before = JSON.stringify(game.board);
  const again = trySwap(game, ...move);
  assert.strictEqual(again.ok, false, 'no swaps after game over');
  assert.strictEqual(JSON.stringify(game.board), before, 'board frozen after game over');
});

test('shuffleBoard rearranges a dead board so that it has a valid move', () => {
  const { shuffleBoard } = require('../game.js');
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 10, rng });
  // Force a dead state: verified dead board (no matches, no valid move).
  const dead = [
    [0, 1, 3, 3, 1, 1],
    [3, 4, 0, 2, 0, 3],
    [2, 2, 1, 3, 2, 4],
    [0, 4, 4, 1, 0, 0],
    [0, 3, 2, 2, 1, 0],
    [3, 1, 1, 0, 3, 4],
  ];
  game.board = dead;
  const { hasValidMove } = require('../engine.js');
  assert.strictEqual(hasValidMove(dead), false, 'precondition: board is dead');
  const result = shuffleBoard(game, makeRng([]));
  assert.strictEqual(result.ok, true);
  assert.ok(hasValidMove(game.board), 'board must be playable after shuffle');
  assert.strictEqual(game.board.length, 6);
});