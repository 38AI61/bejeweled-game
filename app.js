'use strict';
// Browser UI: renders the game state, animates cascades, handles input.
(function () {
  const { createGame, trySwap, ensurePlayable } = window.Game;
  const { canSwap } = window.Engine;

  const SIZE = 8;
  const COLORS = 6;
  const START_MOVES = 30;

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const movesEl = document.getElementById('moves');
  const bestCascadeEl = document.getElementById('best-cascade');
  const toastEl = document.getElementById('toast');
  const overlayEl = document.getElementById('overlay');
  const overTitleEl = document.getElementById('over-title');
  const overTextEl = document.getElementById('over-text');

  let game = null;
  let selected = null; // {r,c}
  let animating = false;
  let dragFrom = null;
  let bestCascade = 0;

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  function gemEl(gem, cls) {
    const d = document.createElement('div');
    d.className = `gem g${gem}` + (cls ? ` ${cls}` : '');
    return d;
  }

  function render(board) {
    boardEl.style.setProperty('--n', String(SIZE));
    boardEl.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.appendChild(gemEl(board[r][c]));
        boardEl.appendChild(cell);
      }
    }
  }

  function cellAt(r, c) {
    return boardEl.children[r * SIZE + c];
  }

  function paintStats() {
    scoreEl.textContent = String(game.score);
    movesEl.textContent = String(game.movesLeft);
    bestCascadeEl.textContent = bestCascade ? `x${bestCascade + 1}` : '—';
  }

  function toast(msg) {
    toastEl.textContent = msg;
    setTimeout(() => { if (toastEl.textContent === msg) toastEl.textContent = ''; }, 1800);
  }

  function showOverlay() {
    overTitleEl.textContent = 'Game over';
    overTextEl.textContent = `Final score: ${game.score}`;
    overlayEl.classList.remove('hidden');
  }

  function newGame() {
    game = createGame({ size: SIZE, colors: COLORS, moves: START_MOVES });
    selected = null;
    animating = false;
    bestCascade = 0;
    overlayEl.classList.add('hidden');
    render(game.board);
    paintStats();
    toast('Good luck!');
  }

  function clearSelection() {
    if (selected) cellAt(selected.r, selected.c).firstChild.classList.remove('sel');
    selected = null;
  }

  function flashInvalid(r1, c1, r2, c2) {
    const a = cellAt(r1, c1).firstChild;
    const b = cellAt(r2, c2).firstChild;
    for (const el of [a, b]) el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 180 }
    );
  }

  async function attemptSwap(r1, c1, r2, c2) {
    if (animating || game.status !== 'playing') return;
    if (!canSwap(game.board, r1, c1, r2, c2)) {
      flashInvalid(r1, c1, r2, c2);
      clearSelection();
      return;
    }
    animating = true;
    clearSelection();

    // Pre-clear boards captured during resolution; we animate step by step.
    const events = [];
    const result = trySwap(game, r1, c1, r2, c2, { onClear: (e) => events.push(e) });

    // Step 1: show the swapped gems briefly.
    const b1 = events[0].board;
    render(b1);
    cellAt(r1, c1).firstChild.classList.add('sel');
    cellAt(r2, c2).firstChild.classList.add('sel');
    await wait(140);
    cellAt(r1, c1).firstChild.classList.remove('sel');
    cellAt(r2, c2).firstChild.classList.remove('sel');

    // Steps 2..n: for each cascade event show pops, then the post-gravity board.
    let prev = b1;
    for (const e of events) {
      for (const { r, c } of e.positions) {
        cellAt(r, c).firstChild.classList.add('pop');
      }
      await wait(300);
      render(e.after);
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (e.after[r][c] !== prev[r][c]) cellAt(r, c).firstChild.classList.add('fall');
        }
      }
      prev = e.after;
      await wait(220);
    }

    if (result.shuffled) {
      toast('No moves left — reshuffling!');
      render(game.board);
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) cellAt(r, c).firstChild.classList.add('new');
      }
      await wait(260);
    }

    // Remove any lingering animation classes so the DOM mirrors pure state.
    for (const el of boardEl.querySelectorAll('.gem')) {
      el.classList.remove('pop', 'fall', 'new', 'sel', 'hint');
    }

    if (result.cascades >= 2) {
      bestCascade = Math.max(bestCascade, result.cascades);
      toast(`Cascade x${result.cascades}! +${result.gained}`);
    }
    paintStats();
    animating = false;
    if (game.status === 'over') showOverlay();
  }

  function onCellClick(ev) {
    const cell = ev.target.closest('.cell');
    if (!cell || animating || game.status !== 'playing') return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (selected && selected.r === r && selected.c === c) { clearSelection(); return; }
    if (selected && Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1) {
      attemptSwap(selected.r, selected.c, r, c);
      return;
    }
    clearSelection();
    selected = { r, c };
    cell.firstChild.classList.add('sel');
  }

  // Drag support: pointerdown grabs a gem, pointerup on an adjacent cell swaps.
  boardEl.addEventListener('pointerdown', (ev) => {
    const cell = ev.target.closest('.cell');
    if (!cell || animating || game.status !== 'playing') return;
    dragFrom = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
  });
  boardEl.addEventListener('pointerup', (ev) => {
    const cell = ev.target.closest('.cell');
    if (!cell || !dragFrom || animating || game.status !== 'playing') { dragFrom = null; return; }
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const from = dragFrom;
    dragFrom = null;
    if (from.r === r && from.c === c) return; // plain click -> click-to-select path
    if (Math.abs(from.r - r) + Math.abs(from.c - c) === 1) attemptSwap(from.r, from.c, r, c);
  });

  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('again').addEventListener('click', newGame);
  boardEl.addEventListener('click', onCellClick);
  document.getElementById('shuffle').addEventListener('click', () => {
    if (animating || game.status !== 'playing') return;
    const { shuffleBoard } = window.Game;
    shuffleBoard(game, game.rng); // free action: never consumes a move
    render(game.board);
    toast('Shuffled!');
  });

  newGame();
  // Read-only debug/test handle (lets browser tests locate valid swaps).
  window.__bejeweled = { getGame: () => game, version: '1.0' };
})();