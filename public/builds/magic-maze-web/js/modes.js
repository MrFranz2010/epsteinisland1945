// modes.js — non-play game modes that suspend the regular update loop.
//
// Healing / mana / magic-map / look-ahead / help / yes-no-confirm. Each is a
// thin port of the corresponding sub-loop in the Pascal source, but rather
// than blocking inside an inner WHILE loop we drive them as alternative
// branches of engine.update().
//
// Source mapping:
//   heal mode      ↔ MMAZE.PAS:786-796
//   mana mode      ↔ MMAZE.PAS:798-807
//   map mode       ↔ MMAZE.PAS:809-836
//   look-ahead     ↔ MMAZE.PAS:838-862
//   help / cheat   ↔ MMAZE.PAS:142-189
//   yes-no confirm ↔ MMAZE.PAS:337-352 (SureYN)
//   F9 restart     ↔ MMAZE.PAS:864
//   F4 load        ↔ MMAZE.PAS:871
//   F5 save        ↔ MMAZE.PAS:873
//
// Save game is persisted to localStorage under SAVE_KEY instead of MM_SAV.GAM.

console.log('[modes.js] loaded');

import * as input from './input.js';
import * as audio from './audio.js';
import { tile } from './levels.js';
import { state } from './engine.js';
import * as flow from './flow.js';

const SAVE_KEY = 'magic_maze_save_v1';

// Help screen tunables (MMAZE.PAS:65, :157).
export const TICK_MS_DEFAULT = 100;
export const TICK_MS_MIN     = 50;
export const TICK_MS_MAX     = 140;
const TICK_MS_STEP = 5;

export const tickMsRef = { value: TICK_MS_DEFAULT };

// --- mode entry from play mode -----------------------------------------

// Check lastPress + held keys for mode triggers. Called at the tail of the
// normal play tick.
export function tryEnter() {
  const last = input.getLastPress();

  // Heal & mana are held-key spells. The conditions match Pascal exactly:
  // heal needs PMana>2 AND PEnergy<97; mana needs PMana<97 AND PEnergy>20.
  if (last === 'heal' && state.pMana > 2 && state.pEnergy < 97) {
    state.mode = 'healing';
    return;
  }
  if (last === 'mana' && state.pMana < 97 && state.pEnergy > 20) {
    state.mode = 'mana';
    return;
  }
  if (last === 'map' && state.pMana > 0) {
    state.pMana--;
    state.mode = 'map';
    return;
  }
  if (last === 'look_ahead' && state.pMana > 0) {
    state.lookAheadX = state.px;
    state.lookAheadY = state.py;
    state.mode = 'lookAhead';
    return;
  }
  if (last === 'help') {
    state.mode = 'help';
    return;
  }
  if (last === 'restart') {
    openConfirm('restart the level', () => restartLevel());
    return;
  }
  if (last === 'load') {
    if (hasSave()) openConfirm('load a saved game', () => loadGame());
    return;
  }
  if (last === 'save') {
    openConfirm('save current game', () => saveGame());
    return;
  }
  // Quit: F10 alone, OR Alt+Q held together (MMAZE.PAS:875). Q alone is a
  // no-op during play — it only acts as 'no' inside a confirm dialog.
  const f10Quit = last === 'quit';
  const altQQuit = input.isPressed('cycle_spell') && input.isPressed('no');
  if (f10Quit || altQQuit) {
    openConfirm('quit this game', () => flow.enterTitle());
    return;
  }
}

// --- per-tick update inside a non-play mode -----------------------------

export function update() {
  switch (state.mode) {
    case 'healing':   updateHealing();   break;
    case 'mana':      updateMana();      break;
    case 'map':       updateMap();       break;
    case 'lookAhead': updateLookAhead(); break;
    case 'help':      updateHelp();      break;
    case 'confirm':   updateConfirm();   break;
  }
  input.consumeLastPress();
}

// Heal: -2 mana, +2 energy per tick while H held. (Pascal does Dec(PMana)
// twice and Inc(PEnergy) twice — the brief's "+1 energy" is a typo.)
function updateHealing() {
  if (!input.isPressed('heal') || state.pMana <= 2 || state.pEnergy >= 97) {
    state.mode = 'play';
    return;
  }
  state.pMana -= 2;
  state.pEnergy += 2;
}

// Summon Mana: +2 mana, -3 energy per tick while N held.
function updateMana() {
  if (!input.isPressed('mana') || state.pMana >= 97 || state.pEnergy <= 20) {
    state.mode = 'play';
    return;
  }
  state.pMana += 2;
  state.pEnergy -= 3;
}

// Magic map: passive overview. M or Esc dismisses.
function updateMap() {
  const last = input.getLastPress();
  if (last === 'map' || last === 'cancel') {
    state.mode = 'play';
  }
}

// Look-ahead: free-roaming "magic eye". Costs 1 mana per tile moved. Exits
// on L, Esc, or zero mana.
function updateLookAhead() {
  if (state.pMana < 1) { state.mode = 'play'; return; }
  const last = input.getLastPress();
  if (last === 'look_ahead' || last === 'cancel') {
    state.mode = 'play';
    return;
  }
  // Each held arrow tries to move the eye; each successful step costs 1 mana.
  // Pascal repeats the same up/right/down/left order.
  if (input.isPressed('up')    && state.lookAheadY > 0)   { state.lookAheadY--; state.pMana--; }
  if (input.isPressed('right') && state.lookAheadX < 127) { state.lookAheadX++; state.pMana--; }
  if (input.isPressed('down')  && state.lookAheadY < 127) { state.lookAheadY++; state.pMana--; }
  if (input.isPressed('left')  && state.lookAheadX > 0)   { state.lookAheadX--; state.pMana--; }
}

// Help screen: speed slider + cheat code (K+D held). Esc returns.
function updateHelp() {
  if (input.isPressed('speed_up')   && tickMsRef.value > TICK_MS_MIN) tickMsRef.value -= TICK_MS_STEP;
  if (input.isPressed('speed_down') && tickMsRef.value < TICK_MS_MAX) tickMsRef.value += TICK_MS_STEP;
  if (input.isPressed('cheat_k') && input.isPressed('cheat_d')) {
    state.keys = [3, 3, 3];
    state.score = 0;
    state.pMana = 100;
    state.pEnergy = 100;
  }
  if (input.getLastPress() === 'cancel') state.mode = 'play';
}

// Yes/no confirmation dialog.
function updateConfirm() {
  if (!state.modal) { state.mode = 'play'; return; }
  if (input.isPressed('yes')) {
    const fn = state.modal.onYes;
    state.modal = null;
    state.mode = 'play';
    if (fn) fn();
  } else if (input.isPressed('no')
             || input.isPressed('cancel')
             || input.isPressed('quit')) {
    state.modal = null;
    state.mode = 'play';
  }
}

// --- helpers ------------------------------------------------------------

function openConfirm(text, onYes) {
  state.modal = { text, onYes };
  state.mode = 'confirm';
}

function restartLevel() {
  // Re-fetch the level from disk via the bootstrap callback. main.js wires it.
  if (state.restartHook) state.restartHook(state.checkpoint.level, state.checkpoint.score);
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: state.checkpoint.level,
      score: state.checkpoint.score,
    }));
    audio.playSnd('bonus');
  } catch (err) {
    console.warn('[modes.js] save failed:', err);
  }
}

function loadGame() {
  const data = readSave();
  if (!data) return;
  if (state.restartHook) state.restartHook(data.level, data.score);
}

function hasSave() {
  return readSave() !== null;
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- accessor for the magic-map renderer --------------------------------

// Returns a colour key per tile for the map view (MMAZE.PAS:818-830).
//   0 = empty, 1 = wall, 2 = monster, 3 = locked door, 4 = player
export const MAP_OPEN = 0, MAP_WALL = 1, MAP_MONSTER = 2, MAP_DOOR = 3, MAP_PLAYER = 4;
export function mapPixelKind(x, y) {
  if (x === state.px && y === state.py) return MAP_PLAYER;
  const t = tile(state.level, x, y);
  if (t[2]) return MAP_WALL;
  for (const m of state.level.monsters) {
    if (m.hp > 0 && m.x === x && m.y === y) return MAP_MONSTER;
  }
  const b = t[1];
  if (b >= 33 && b <= 35) return MAP_DOOR;
  return MAP_OPEN;
}
