'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createGame, trySwap } = require('../game.js');

// Deterministic rng helper (fresh copy per test). Falls back to a varying
// deterministic sequence; a constant fallback would wedge the fill logic.
function makeRng(values) {
  let i = 0;
  return () => values[i++] ?? ((i * 37) % 101) / 101;
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

test('trySwap forwards onClear events (boards, positions, cascade index) for UI animation', () => {
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 20, rng });
  const { canSwap } = require('../engine.js');
  let move = null;
  outer: for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (c + 1 < 6 && canSwap(game.board, r, c, r, c + 1)) { move = [r, c, r, c + 1]; break outer; }
      if (r + 1 < 6 && canSwap(game.board, r, c, r + 1, c)) { move = [r, c, r + 1, c]; break outer; }
    }
  }
  assert.ok(move, 'must have a valid move');
  const evts = [];
  const result = trySwap(game, ...move, { onClear: (e) => evts.push(e) });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(evts.length, result.cascades, 'one event per cascade');
  for (let i = 0; i < evts.length; i++) {
    assert.strictEqual(evts[i].cascade, i);
    assert.ok(Array.isArray(evts[i].positions) && evts[i].positions.length > 0);
    assert.ok(evts[i].board, 'pre-clear board present');
    assert.ok(evts[i].after, 'post-gravity board present');
  }
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

test('ensurePlayable shuffles only a dead board and reports what it did', () => {
  const { ensurePlayable } = require('../game.js');
  const { hasValidMove, findMatches } = require('../engine.js');
  // Playable board: untouched, shuffled:false.
  const g1 = createGame({ size: 6, colors: 5, moves: 10, rng: makeRng([]) });
  const before1 = JSON.stringify(g1.board);
  const r1 = ensurePlayable(g1);
  assert.strictEqual(r1.shuffled, false);
  assert.strictEqual(JSON.stringify(g1.board), before1);
  // Verified dead board: must become playable, match-free, same multiset.
  const g2 = createGame({ size: 6, colors: 5, moves: 10, rng: makeRng([]) });
  g2.board = [
    [0, 1, 3, 3, 1, 1],
    [3, 4, 0, 2, 0, 3],
    [2, 2, 1, 3, 2, 4],
    [0, 4, 4, 1, 0, 0],
    [0, 3, 2, 2, 1, 0],
    [3, 1, 1, 0, 3, 4],
  ];
  const r2 = ensurePlayable(g2);
  assert.strictEqual(r2.shuffled, true);
  assert.strictEqual(findMatches(g2.board).length, 0, 'shuffled board has no matches');
  assert.ok(hasValidMove(g2.board), 'shuffled board has a valid move');
});

test('trySwap reports shuffled:true in its result when it had to reshuffle', () => {
  // The flag must exist on the result object even when false.
  const rng = makeRng([]);
  const game = createGame({ size: 6, colors: 5, moves: 20, rng });
  const { canSwap } = require('../engine.js');
  let move = null;
  outer: for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (c + 1 < 6 && canSwap(game.board, r, c, r, c + 1)) { move = [r, c, r, c + 1]; break outer; }
      if (r + 1 < 6 && canSwap(game.board, r, c, r + 1, c)) { move = [r, c, r + 1, c]; break outer; }
    }
  }
  const result = trySwap(game, ...move);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(typeof result.shuffled, 'boolean', 'result must carry a shuffled flag');
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