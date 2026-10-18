'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createBoard, findMatches } = require('../engine.js');

test('createBoard returns an 8x8 grid with valid gem types and no pre-existing matches', () => {
  const board = createBoard({ size: 8, colors: 6 });
  assert.strictEqual(board.length, 8);
  for (const row of board) {
    assert.strictEqual(row.length, 8);
    for (const gem of row) {
      assert.ok(Number.isInteger(gem) && gem >= 0 && gem < 6, `gem ${gem} must be an integer in 0..5`);
    }
  }
  assert.deepStrictEqual(findMatches(board), [], 'fresh board must start with no matches');
});