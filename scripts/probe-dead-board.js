'use strict';
// One-off probe: find a genuinely dead 6x6 board (no matches, no valid move).
const { createBoard, hasValidMove, findMatches } = require('../engine.js');

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1103515245 * s + 12345) >>> 0;
    return s / 4294967296;
  };
}

const configs = [
  { size: 6, colors: 5 },
  { size: 6, colors: 6 },
  { size: 8, colors: 6 },
  { size: 4, colors: 4 },
];
for (const cfg of configs) {
  let found = false;
  for (let seed = 1; seed < 200000 && !found; seed++) {
    const rng = lcg(seed);
    const b = createBoard({ size: cfg.size, colors: cfg.colors, rng });
    if (findMatches(b).length === 0 && !hasValidMove(b)) {
      console.log(`DEAD size=${cfg.size} colors=${cfg.colors} seed=${seed}`);
      console.log('BOARD=' + JSON.stringify(b));
      found = true;
    }
  }
  if (!found) console.log(`none: size=${cfg.size} colors=${cfg.colors} (200000 seeds)`);
}