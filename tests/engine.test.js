'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createBoard, findMatches, canSwap, resolveGravity } = require('../engine.js');

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