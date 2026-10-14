// main.js — bootstrap and main loop.
//
// Boots into the title screen. From there, "New Game" starts at level 1,
// "Restore Game" loads from localStorage, "Train Level" picks a single level
// to play standalone, "Quit" prompts for confirmation. The frame loop is a
// fixed-timestep accumulator at 10 Hz (matches MMAZE.PAS DefaultGameLoopDelay
// = 100 ms) inside requestAnimationFrame.

console.log('[main.js] loaded');

import * as assets from './assets.js';
import * as levels from './levels.js';
import * as input from './input.js';
import * as engine from './engine.js';
import * as render from './render.js';
import * as audio from './audio.js';
import * as flow from './flow.js';
import { tickMsRef } from './modes.js';

const VIEW_W = 320;
const VIEW_H = 200;
const MAX_LEVELS = 10;
const SAVE_KEY = 'magic_maze_save_v1';

let busy = false;       // true while async-loading a level

async function boot() {
  await assets.load();
  engine.state.levelList = await levels.loadIndex();
  engine.newGame();

  engine.state.flowHooks = {
    newGame:  () => startGame(1, 0, false),
    restore:  () => restoreFromSave(),
    train:    (n) => startGame(n, 0, true),
    quit:     () => { /* web has no real quit; stay on title */ },
    applyLoadedLevel: (level) => { engine.applyLevel(level); },
  };
  engine.state.restartHook = (lvl, score) => restartAt(lvl, score);

  flow.enterTitle();

  const canvas = document.getElementById('game');
  render.init(canvas);
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  input.attach(audio.unlockOnGesture);

  let acc = 0;
  let last = performance.now();
  function frame(now) {
    acc += now - last;
    last = now;
    const tick = tickMsRef.value;
    if (acc > tick * 5) acc = tick * 5;
    while (acc >= tick) {
      engine.update();
      acc -= tick;
    }

    flow.advanceFrame(now);

    // levelExited or gameOver during play → switch to the appropriate flow.
    if (engine.state.mode === 'play') {
      if (engine.state.levelExited && !busy) {
        engine.state.levelExited = false;
        beginLevelTransition();
      } else if (engine.state.gameOver) {
        flow.enterGameOverScreen();
      }
    }

    render.draw(engine.state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function startGame(levelIndex, score, training) {
  if (busy) return;
  busy = true;
  try {
    const level = await levels.load(levelIndex);
    engine.newGame();
    engine.state.score = score;
    engine.state.training = training;
    engine.applyLevel(level);
    engine.state.mode = 'play';
  } catch (err) {
    console.error('[main.js] startGame failed:', err);
    flow.enterTitle();
  } finally {
    busy = false;
  }
}

async function restartAt(levelIndex, score) {
  if (busy) return;
  busy = true;
  try {
    const level = await levels.load(levelIndex);
    engine.state.score = score;
    engine.applyLevel(level);
    engine.state.mode = 'play';
  } catch (err) {
    console.error('[main.js] restart failed:', err);
    engine.state.gameOver = true;
  } finally {
    busy = false;
  }
}

function restoreFromSave() {
  let data = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch { /* ignore */ }
  if (data) startGame(data.level, data.score, false);
  else      startGame(1, 0, false);
}

async function beginLevelTransition() {
  busy = true;
  const next = engine.state.level.index + 1;

  // Training mode never advances — one level then back to title.
  if (engine.state.training) {
    flow.enterTitle();
    busy = false;
    return;
  }

  // Beat the last level → end sequence.
  if (next > MAX_LEVELS) {
    engine.state.gameWon = true;
    flow.enterEndSequence();
    busy = false;
    return;
  }

  flow.startTransition(next, '', false);
  try {
    const level = await levels.load(next);
    flow.transitionLevelLoaded(level);
  } catch (err) {
    console.error('[main.js] level load failed:', err);
    engine.state.gameOver = true;
    flow.enterGameOverScreen();
  } finally {
    busy = false;
  }
}

function fitCanvas(canvas) {
  const sx = Math.floor(window.innerWidth  / VIEW_W);
  const sy = Math.floor(window.innerHeight / VIEW_H);
  const scale = Math.max(1, Math.min(sx, sy));
  canvas.style.width  = (VIEW_W * scale) + 'px';
  canvas.style.height = (VIEW_H * scale) + 'px';
}

boot().catch((err) => {
  console.error('[main.js] boot failed:', err);
  document.body.style.color = '#f55';
  document.body.style.font = '14px monospace';
  document.body.textContent = 'Boot failed: ' + err.message;
});
