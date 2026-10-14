// flow.js — game lifecycle modes: title screen, training selector, level
// transition, end sequence. These wrap around regular play; modes.js handles
// in-game player actions.
//
// Source mapping:
//   TitleScreen          ↔ MMAZE.PAS:1145-1209
//   SelectTrainingLevel  ↔ MMAZE.PAS:1089-1142
//   "Entering level N"   ↔ MMAZE.PAS:268-294
//   PlayEndSequence      ↔ MMAZE.PAS:908-1038

console.log('[flow.js] loaded');

import * as input from './input.js';
import { state } from './engine.js';

// --- title menu ---------------------------------------------------------

export const TITLE_ITEMS = ['New Game', 'Restore Game', 'Train Level', 'Quit'];

// Phase durations in ms.
const FADE_OUT_1_MS = 500;
const FADE_OUT_2_MS = 250;
const FADE_IN_MS    = 500;
const END_IMAGE_HOLD_MS = 1500;
const CREDITS_LINE_MS   = 600;      // ~600 ms per 16-px line — Pascal-ish pace

export function enterTitle() {
  state.mode = 'title';
  state.titleCursor = 0;
  state.training = false;
  state.gameOver = false;
  state.gameWon = false;
  state.spell = null;
  state.modal = null;
  state.transition = null;
  state.endSeq = null;
}

// Single dispatcher called by engine.update() when state.mode is one of the
// flow modes. Per-tick clearing of lastPress matches modes.js conventions.
export function update() {
  switch (state.mode) {
    case 'title':           updateTitle();          break;
    case 'trainingSelect':  updateTrainingSelect(); break;
    case 'transition':      updateTransition();     break;
    case 'endSequence':     updateEndSequence();    break;
    case 'gameOverScreen':  updateGameOverScreen(); break;
  }
  input.consumeLastPress();
}

// Frame-rate driven (rAF) advancement for time-based phases. main.js calls
// this every animation frame in addition to the tick-rate update().
export function advanceFrame(nowMs) {
  if (state.mode === 'transition') stepTransition(nowMs);
  else if (state.mode === 'endSequence') stepEndSequence(nowMs);
}

// --- title menu update --------------------------------------------------

function updateTitle() {
  const last = input.getLastPress();
  if ((last === 'up' || last === 'vol_up') && state.titleCursor > 0) {
    state.titleCursor--;
  } else if ((last === 'down' || last === 'vol_down')
             && state.titleCursor < TITLE_ITEMS.length - 1) {
    state.titleCursor++;
  } else if (last === 'confirm' || last === 'yes' || last === 'cast') {
    titleSelect(state.titleCursor);
  } else if (last === 'cancel' || last === 'quit' || last === 'no') {
    state.titleCursor = 3;     // "Quit" — Pascal jumps focus on Esc/Q
  }
}

function titleSelect(idx) {
  const hooks = state.flowHooks || {};
  switch (idx) {
    case 0: if (hooks.newGame) hooks.newGame(); break;
    case 1: if (hooks.restore) hooks.restore(); break;
    case 2: state.mode = 'trainingSelect'; state.trainCursor = 0; break;
    case 3: if (hooks.quit) hooks.quit(); break;
  }
}

// --- training level select ----------------------------------------------

function updateTrainingSelect() {
  const last = input.getLastPress();
  const max = (state.levelList || []).length - 1;
  if ((last === 'up' || last === 'vol_up') && state.trainCursor > 0) {
    state.trainCursor--;
  } else if ((last === 'down' || last === 'vol_down') && state.trainCursor < max) {
    state.trainCursor++;
  } else if (last === 'confirm' || last === 'yes' || last === 'cast') {
    const hooks = state.flowHooks || {};
    if (hooks.train) hooks.train(state.trainCursor + 1);
  } else if (last === 'cancel' || last === 'quit' || last === 'no') {
    enterTitle();
  }
}

// --- level transition ---------------------------------------------------

// Called by main.js once it has the next level loaded (or at least scheduled).
export function startTransition(levelIndex, levelName, isVictory) {
  state.mode = 'transition';
  state.transition = {
    phase: 'fadeOut1',
    phaseStartMs: performance.now(),
    progress: 0,
    levelIndex,
    levelName: levelName || '',
    nextLevelLoaded: false,
    nextLevel: null,
    isVictory: !!isVictory,
  };
  state.levelExited = false;
}

export function transitionLevelLoaded(level) {
  if (!state.transition) return;
  state.transition.nextLevelLoaded = true;
  state.transition.nextLevel = level;
  state.transition.levelName = level.name;
}

function updateTransition() {
  if (!state.transition) return;
  // 'show' phase advances on keypress; everything else is time-driven.
  if (state.transition.phase === 'show') {
    if (input.getLastPress()) {
      state.transition.phase = 'fadeOut2';
      state.transition.phaseStartMs = performance.now();
      state.transition.progress = 0;
    }
  }
}

function stepTransition(nowMs) {
  const t = state.transition;
  if (!t) return;
  const elapsed = nowMs - t.phaseStartMs;

  switch (t.phase) {
    case 'fadeOut1':
      t.progress = Math.min(1, elapsed / FADE_OUT_1_MS);
      // Wait for the next level's data before revealing the info screen, so
      // the level name shows up correctly. JSON fetch usually beats the fade
      // anyway, but on a cold connection this stalls fade-at-black until load.
      if (t.progress >= 1 && t.nextLevelLoaded) {
        t.phase = 'show';
        t.phaseStartMs = nowMs;
        t.progress = 0;
      }
      break;
    case 'show':
      // Wait for keypress; updateTransition() advances us.
      break;
    case 'fadeOut2':
      t.progress = Math.min(1, elapsed / FADE_OUT_2_MS);
      if (t.progress >= 1 && t.nextLevelLoaded) {
        const hooks = state.flowHooks || {};
        if (hooks.applyLoadedLevel) hooks.applyLoadedLevel(t.nextLevel);
        t.phase = 'fadeIn';
        t.phaseStartMs = nowMs;
        t.progress = 0;
      }
      break;
    case 'fadeIn':
      t.progress = Math.min(1, elapsed / FADE_IN_MS);
      if (t.progress >= 1) {
        state.mode = 'play';
        state.transition = null;
      }
      break;
  }
}

// --- end sequence -------------------------------------------------------

// 33-line credits roll, transcribed from MMAZE.PAS:910-945. Index keys into
// COL_KEYS for the colour palette index per line.
//   K = generic light (palette 255)
//   R = colRed (20)
//   G = colGreen (30)
//   B = colBlue (40)
//   . = blank line
const CREDITS = [
  ['K', "LuciPer escapes into the dimension"],
  ['K', "bettter known as...."],
  ['R', "--++**++--"],
  ['R', "-> HELL <-"],
  ['R', "--++**++--"],
  ['.', ''],
  ['B', "The world is once again safe..."],
  ['R', "FOR NOW!"],
  ['.', ''],
  ['B', "Thank you for playing Magic Maze."],
  ['B', "Hope you enjoyed it!"],
  ['G', "If you did, please send me a small"],
  ['G', "contribution, or tell me what you"],
  ['G', "think of Magic Maze. See README.TXT"],
  ['G', "file for details!"],
  ['.', ''],
  ['K', "..Good Bye.."],
  ['.', ''],
  ['.', ''],
  ['.', ''],
  ['R', "WHAT'S THAT?!?"],
  ['G', "Did you expect to see a picture"],
  ['G', "of the sexy, young virgin now?"],
  ['B', "Preferably lightly dressed?"],
  ['R', "Why you {}=>#%&!!!!"],
  ['B', "Do you want the world to think"],
  ['B', "that all PC-freaks are drooling,"],
  ['B', "girlie-picture-oogling no-brainers?"],
  ['R', "NO WAY!"],
  ['.', ''],
  ['G', "(To all that did NOT expect such a"],
  ['G', "picture, pardon my outburst.)"],
  ['.', ''],
  ['K', "Now, GOOD-GOOD BYE!!! :-)"],
];

export function getCredits() { return CREDITS; }

export function enterEndSequence() {
  state.mode = 'endSequence';
  state.endSeq = {
    phase: 'image',          // 'image' → 'credits' → 'done'
    phaseStartMs: performance.now(),
    scrollY: 0,              // pixel scroll offset for credits
  };
}

function updateEndSequence() {
  if (!state.endSeq) return;
  const last = input.getLastPress();
  if (state.endSeq.phase === 'image') {
    // Any key after the minimum hold advances to credits.
    const elapsed = performance.now() - state.endSeq.phaseStartMs;
    if (last && elapsed >= END_IMAGE_HOLD_MS) {
      state.endSeq.phase = 'credits';
      state.endSeq.phaseStartMs = performance.now();
      state.endSeq.scrollY = 0;
    }
  } else if (state.endSeq.phase === 'credits') {
    if (last === 'cancel' || last === 'quit' || last === 'no'
        || last === 'confirm' || last === 'yes') {
      finishEndSequence();
    }
  }
}

function stepEndSequence(nowMs) {
  if (!state.endSeq) return;
  if (state.endSeq.phase !== 'credits') return;
  // Credits scroll up at one line every CREDITS_LINE_MS. With 16 px line
  // height that's ~10.7 px/sec.
  const PIX_PER_MS = 16 / CREDITS_LINE_MS;
  state.endSeq.scrollY += (nowMs - (state.endSeq.lastFrameMs || nowMs)) * PIX_PER_MS;
  state.endSeq.lastFrameMs = nowMs;
  // Done when fully scrolled past the last line + a tail screen.
  const totalPx = (CREDITS.length + 12) * 16;
  if (state.endSeq.scrollY > totalPx) finishEndSequence();
}

function finishEndSequence() {
  state.endSeq = null;
  enterTitle();
}

// --- game-over screen ---------------------------------------------------

export function enterGameOverScreen() {
  state.mode = 'gameOverScreen';
  state.gameOverStartMs = performance.now();
}

function updateGameOverScreen() {
  // Wait at least 1s, then any key returns to title.
  if (performance.now() - state.gameOverStartMs < 1000) return;
  if (input.getLastPress()) {
    enterTitle();
  }
}
