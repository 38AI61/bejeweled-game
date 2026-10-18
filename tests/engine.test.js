'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createBoard, findMatches, canSwap, resolveGravity, hasValidMove, resolveBoard } = require('../engine.js');

// Deterministic rng for tests: replays a fixed list of values in order.
function makeRng(values) {
  let i = 0;
  return () => values[i++] ?? 0.99;
}

// resolveBoard calls onClear(event) for each cascade step; helper collects them.
function runResolve(board, colors, rng) {
  const evts = [];
  const result = resolveBoard(board, { colors, rng, onClear: (e) => evts.push(e) });
  return { result, evts };
}

test('findMatches detects a single horizontal run of 3', () => {
  const board = [
    [0, 1, 1, 1, 2],
    [3, 0, 2, 3, 1],
    [1, 2, 0, 0, 2],
    [2, 3, 1, 2, 0],
    [0, 1, 2, 3, 1],
  ];
  assert.deepStrictEqual(findMatches(board), [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }]);
});

test('findMatches detects a single vertical run of 3', () => {
  const board = [
    [0, 1, 2, 3, 1],
    [3, 1, 3, 0, 2],
    [1, 1, 2, 3, 0],
    [2, 3, 1, 2, 3],
    [0, 1, 2, 3, 1],
  ];
  assert.deepStrictEqual(findMatches(board), [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }]);
});

test('findMatches returns [] when no three are aligned', () => {
  const board = [
    [0, 1, 2, 3, 1],
    [3, 0, 2, 0, 2],
    [1, 2, 0, 3, 0],
    [2, 3, 1, 2, 3],
    [0, 1, 2, 3, 1],
  ];
  assert.deepStrictEqual(findMatches(board), []);
});

test('findMatches flags every gem of a run of 5 as one match', () => {
  const board = [
    [0, 1, 1, 1, 1, 1],
    [3, 0, 2, 3, 1, 0],
    [1, 2, 0, 0, 2, 3],
    [2, 3, 1, 2, 0, 1],
    [0, 1, 2, 3, 1, 2],
    [1, 2, 0, 1, 3, 0],
  ];
  assert.deepStrictEqual(findMatches(board), [
    { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }, { r: 0, c: 5 },
  ]);
});

test('findMatches detects an L/T intersection from both directions', () => {
  const board = [
    [1, 1, 1, 3, 0],
    [3, 1, 2, 1, 2],
    [1, 1, 0, 1, 3],
    [2, 3, 1, 2, 0],
    [0, 1, 2, 3, 1],
  ];
  assert.deepStrictEqual(findMatches(board), [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 1 },
  ]);
});

test('findMatches returns [] for a board filled with nulls (already-cleared state)', () => {
  const board = Array.from({ length: 4 }, () => Array(4).fill(null));
  assert.deepStrictEqual(findMatches(board), []);
});

// ---- canSwap ----

// No pre-existing matches; swapping (0,2)<->(0,3) makes row0 [4,4,4,0,1].
const swapBoard = [
  [4, 4, 0, 4, 1],
  [1, 0, 4, 2, 3],
  [2, 3, 1, 0, 2],
  [0, 1, 2, 3, 4],
];

test('canSwap accepts horizontally adjacent cells whose swap creates a match', () => {
  assert.strictEqual(canSwap(swapBoard, 0, 2, 0, 3), true);
});

test('canSwap rejects adjacent cells whose swap creates no match', () => {
  // (1,0)<->(1,1): row1 becomes [0,1,4,2,3]; no run appears anywhere.
  assert.strictEqual(canSwap(swapBoard, 1, 0, 1, 1), false);
});

test('canSwap rejects diagonal (non-orthogonally adjacent) cells', () => {
  assert.strictEqual(canSwap(swapBoard, 0, 2, 1, 3), false);
});

test('canSwap rejects far apart cells', () => {
  assert.strictEqual(canSwap(swapBoard, 0, 0, 3, 4), false);
});

test('canSwap rejects out-of-bounds cells', () => {
  assert.strictEqual(canSwap(swapBoard, 0, 4, 0, 5), false);
  assert.strictEqual(canSwap(swapBoard, -1, 0, 0, 0), false);
  assert.strictEqual(canSwap(swapBoard, 0, 0, 4, 0), false);
});

// ---- resolveGravity ----

test('resolveGravity collapses gems down per column and refills nulls from rng', () => {
  const board = [
    [3, null, 1],
    [2, 3, null],
    [1, null, 3],
  ];
  // rng queue: 0.0->gem0, 0.5->gem1, 0.9->gem2 (colors=3), consumed in reading order.
  const rng = makeRng([0.0, 0.5, 0.9]);
  const result = resolveGravity(board, { colors: 3, rng });
  assert.deepStrictEqual(result, [
    [3, 0, 2],
    [2, 1, 1],
    [1, 3, 3],
  ]);
});

test('resolveGravity fully refills an all-null column', () => {
  const board = [
    [null],
    [null],
  ];
  const rng = makeRng([0.4, 0.9]); // gems 0 and 1 (colors=2)
  const result = resolveGravity(board, { colors: 2, rng });
  assert.deepStrictEqual(result, [[0], [1]]);
});

test('resolveGravity leaves a full board untouched and consumes no rng values', () => {
  const board = [
    [0, 1],
    [1, 0],
  ];
  let calls = 0;
  const rng = () => { calls++; return 0.5; };
  const result = resolveGravity(board, { colors: 2, rng });
  assert.deepStrictEqual(result, board);
  assert.strictEqual(calls, 0);
});

// ---- hasValidMove ----

test('hasValidMove finds a move on a board that has one', () => {
  assert.strictEqual(hasValidMove(swapBoard), true);
});

test('hasValidMove returns false when no adjacent swap can create a match', () => {
  // On a 2x2 board no run of 3 is possible, so no swap can ever match.
  const dead = [
    [0, 1],
    [1, 0],
  ];
  assert.strictEqual(hasValidMove(dead), false);
});

// ---- resolveBoard (full cascade) ----

test('resolveBoard clears one match, applies gravity, refills, and stops when stable', () => {
  const board = [
    [0, 1, 1, 1, 2],
    [3, 0, 2, 3, 1],
    [1, 2, 0, 0, 2],
    [2, 3, 1, 2, 0],
    [0, 1, 2, 3, 1],
  ];
  // Hand-traced refill draws (reading order): col1 top->gem0, col2 top->gem2,
  // col3 top->gem3. Distinct gems so no new match forms: exactly one cascade.
  const rng = makeRng([0.0, 0.5, 0.7]);
  const { result, evts } = runResolve(board, 5, rng);
  // Structural invariants:
  assert.strictEqual(result.length, 5);
  for (const row of result) assert.strictEqual(row.length, 5);
  assert.deepStrictEqual(findMatches(result), [], 'result must be stable (no matches)');
  for (const row of result) for (const gem of row) assert.ok(gem !== null, 'no holes left');
  // Events must record the single cleared trio.
  assert.strictEqual(evts.length, 1);
  assert.deepStrictEqual(evts[0].positions, [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }]);
  assert.strictEqual(evts[0].cascade, 0);
  // Refilled row0 is [0,0,2,3,2] (distinct refills, survivors sunk below).
  assert.deepStrictEqual(result[0], [0, 0, 2, 3, 2]);
});

test('resolveBoard cascades when gravity creates a new match', () => {
  // Column 1: after the top-row 1s clear, the 1s below sink into a vertical run.
  const board = [
    [1, 1, 1, 3, 0],
    [3, 1, 2, 1, 2],
    [1, 1, 0, 1, 3],
    [2, 3, 1, 2, 0],
    [0, 1, 2, 3, 1],
  ];
  // Hand-traced: pass1 clears the 1s (row0 trio + col1 r1,r2); refills then
  // build a new row0 trio of 2s (pass2); pass3 refills end stable.
  // Draw order: col0, col1 r0, col1 r1, col1 r2, col2 | col0, col1, col2.
  const rng = makeRng([0.4, 0.4, 0.1, 0.8, 0.4, 0.1, 0.3, 0.6]);
  const { result, evts } = runResolve(board, 5, rng);
  assert.deepStrictEqual(findMatches(result), [], 'final board must be stable');
  assert.strictEqual(evts.length, 2, `expected exactly 2 cascades, got ${evts.length}`);
  for (let i = 0; i < evts.length; i++) assert.strictEqual(evts[i].cascade, i, 'cascade index must increase');
  assert.deepStrictEqual(
    [...evts[0].positions].sort((a, b) => a.r - b.r || a.c - b.c),
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 1 }]
  );
  assert.deepStrictEqual(
    [...evts[1].positions].sort((a, b) => a.r - b.r || a.c - b.c),
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]
  );
});

test('resolveBoard returns an equal board untouched when there is nothing to clear', () => {
  const board = [
    [0, 1, 2, 3],
    [3, 0, 1, 2],
    [2, 3, 0, 1],
    [1, 2, 3, 0],
  ];
  const rng = makeRng([]);
  const { result, evts } = runResolve(board, 4, rng);
  assert.deepStrictEqual(result, board);
  assert.deepStrictEqual(evts, []);
});

test('resolveBoard terminates even when a degenerate rng always refills the same gem', () => {
  // A constant rng can keep re-creating matches forever; the engine must cap passes.
  const board = [
    [0, 1, 1, 1],
    [2, 3, 0, 2],
    [1, 2, 3, 0],
    [3, 0, 2, 1],
  ];
  const rng = () => 0.99; // every refill is gem 4 (colors=5)
  const result = resolveBoard(board, { colors: 5, rng });
  assert.strictEqual(result.length, 4, 'must return a board instead of looping forever');
});