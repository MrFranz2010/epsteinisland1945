// engine.js — game state, lifecycle, per-tick orchestration, shared helpers.
//
// State and constants live here so player.js and combat.js can reach them.
// The big behavioural blocks (item pickup, movement, spells, monsters) are
// each in their own file — see player.js and combat.js.

console.log('[engine.js] loaded');

import * as input from './input.js';
import * as audio from './audio.js';
import { tile } from './levels.js';
import * as player from './player.js';
import * as combat from './combat.js';
import * as modes from './modes.js';
import * as flow from './flow.js';

// --- shared constants (re-exported) -------------------------------------

// Direction encoding: 0=Up, 1=Right, 2=Down, 3=Left (MMAZE.PAS:55-56).
export const MOV_X = [ 0,  1, 0, -1];
export const MOV_Y = [-1,  0, 1,  0];

// Sprite-index ranges from the Pascal constants block (MMAZE.PAS:79-87).
export const C_SPELLS       = 10;   // 10/11/12 = lightning/bigball/coolcube
export const C_BLOOD_SPLAT  =  9;
export const C_KEYS         = 30;
export const C_LOCKED_DOOR  = 33;
export const C_CHEST        = 20;
export const C_LIFE_POTION  = 21;
export const C_MANA_POTION  = 22;
export const C_MONEY_BAG    = 23;
export const C_ORB          = 24;
export const C_EXIT         = 39;
export const C_MONSTERS     = 40;

// Spell tunables (MMAZE.PAS:71-77).
export const SPELL_DAMAGE   = [4, 9, 20];
export const SPELL_MANA_USE = [1, 2, 4];
export const SPELL_RANGE    = [7, 8, 10];

// PathBlocked codes (MMAZE.PAS:84). Values matter — combat allows spells to
// pass through PB_MONSTER but not PB_WALL/PB_LOCKED_DOOR/PB_PLAYER.
export const PB_OPEN        =  0;
export const PB_PLAYER      =  1;
export const PB_LOCKED_DOOR =  2;
export const PB_WALL        =  8;
export const PB_MONSTER     = 16;

// Game-wide tunables (MMAZE.PAS:66-69).
export const MON_DELAY          = 7;
export const MAX_KEYS_PER_COLOR = 3;
export const CHEST_POINTS       = 50;
export const MONEY_BAG_POINTS   = 250;
export const MONSTER_POINTS     = 10;
export const MAX_CAST_SPELLS    = 3;

const GAIN_MANA_DELAY    = 24;
const LOSE_ENERGY_DELAY  = 256;
const LEVEL_MIN_ENERGY   = 90;
const LEVEL_MIN_MANA     = 80;

// --- shared mutable state -----------------------------------------------

export const state = {
  level: null,
  px: 0, py: 0, pm: 2,
  pEnergy: 0,
  pMana: 0,
  score: 0,
  keys: [0, 0, 0],
  currentSpell: 1,
  spell: null,         // { type, x, y, dir, power } when in flight
  monWait: 0,
  tickCount: 0,
  gameOver: false,
  levelExited: false,
  gameWon: false,
  // M4 — non-play modes (see modes.js):
  mode: 'title',       // 'title' | 'play' | 'healing' | 'mana' | 'map' | 'lookAhead' | 'help' | 'confirm' | 'transition' | 'trainingSelect' | 'endSequence' | 'gameOverScreen'
  modal: null,         // { text, onYes } when mode === 'confirm'
  lookAheadX: 0, lookAheadY: 0,
  checkpoint: { level: 1, score: 0 },   // restart/save baseline (set per level)
  restartHook: null,   // (level, score) => void, wired by main.js
  // M5 — flow / lifecycle:
  training: false,
  titleCursor: 0,
  trainCursor: 0,
  levelList: null,                      // [{index, name, file}, …] from levels/index.json
  transition: null,                     // { phase, progress, levelIndex, levelName, … }
  endSeq: null,                         // { phase, scrollY, … }
  gameOverStartMs: 0,
  flowHooks: null,                      // { newGame, restore, train, quit, applyLoadedLevel }
};

// --- lifecycle ----------------------------------------------------------

export function newGame() {
  state.score = 0;
  state.pEnergy = 0;
  state.pMana = 0;
  state.currentSpell = 1;
  state.gameOver = false;
  state.levelExited = false;
  state.gameWon = false;
  state.tickCount = 0;
  state.spell = null;
  state.monWait = 0;
  state.mode = 'play';
  state.modal = null;
}

// Bind the engine to a freshly-loaded level. Carries score/energy/mana/spell
// across; resets keys; applies the per-level energy/mana floors
// (MMAZE.PAS:246-247). Also snapshots a restart/save checkpoint for F4/F5/F9.
//
// Caller is responsible for setting state.mode afterwards — applyLevel is
// reused by initial load, level transitions, and restarts, each of which
// wants different mode handling.
export function applyLevel(level) {
  state.level = level;
  state.px = level.start[0];
  state.py = level.start[1];
  state.pm = 2;
  state.keys = [0, 0, 0];
  if (state.pEnergy < LEVEL_MIN_ENERGY) state.pEnergy = LEVEL_MIN_ENERGY;
  if (state.pMana   < LEVEL_MIN_MANA)   state.pMana   = LEVEL_MIN_MANA;
  state.gameOver = false;
  state.levelExited = false;
  state.spell = null;
  state.monWait = 0;
  state.modal = null;
  state.checkpoint = { level: level.index, score: state.score };
}

// --- main tick ----------------------------------------------------------

export function update() {
  // Flow modes (title, training, level transition, end sequence, game over)
  // are the outermost shells — they run with no level loaded or with the game
  // logic suspended.
  if (state.mode === 'title' || state.mode === 'trainingSelect'
      || state.mode === 'transition' || state.mode === 'endSequence'
      || state.mode === 'gameOverScreen') {
    flow.update();
    return;
  }

  if (!state.level || state.gameWon) return;
  if (state.gameOver) return;

  // Non-play modes (heal/mana/map/lookahead/help/confirm) suspend the regular
  // game loop, exactly like the inner WHILE loops in the Pascal source.
  if (state.mode !== 'play') {
    modes.update();
    return;
  }

  player.pickupAtPlayerTile();
  if (state.levelExited) return;

  player.handleMovement();
  combat.handleSpellCast();
  combat.moveSpell();
  combat.monsterInteractions();
  combat.moveMonsters();
  handleSpellCycle();
  handleVolumeAndSound();
  regenAndDecay();
  modes.tryEnter();           // heal/mana/map/lookAhead/F-keys

  if (state.pEnergy < 1) {
    state.pEnergy = 0;
    state.gameOver = true;
  }

  input.consumeLastPress();
  state.tickCount++;
}

// --- shared helpers -----------------------------------------------------

// PathBlocked code for a tile (MMAZE.PAS:598-609). Order: wall → monster →
// player → locked door, where each later check overrides earlier.
export function pathBlocked(x, y) {
  const t = tile(state.level, x, y);
  let pb = t[2] ? PB_WALL : PB_OPEN;
  for (const m of state.level.monsters) {
    if (m.hp > 0 && m.x === x && m.y === y) { pb = PB_MONSTER; break; }
  }
  if (x === state.px && y === state.py) pb = PB_PLAYER;
  const b = t[1];
  if (b >= C_LOCKED_DOOR && b <= C_LOCKED_DOOR + 2) pb = PB_LOCKED_DOOR;
  return pb;
}

export function clearTile(x, y) {
  state.level.tiles[y][x][1] = 0;
}

// --- internals ----------------------------------------------------------

function handleSpellCycle() {
  if (input.getLastPress() === 'cycle_spell') {
    state.currentSpell = (state.currentSpell + 1) % MAX_CAST_SPELLS;
  }
}

// PgUp/PgDn adjust master volume; S toggles sound on/off (MMAZE.PAS:774-782).
function handleVolumeAndSound() {
  if (input.isPressed('vol_up'))   audio.incVolume();
  if (input.isPressed('vol_down')) audio.decVolume();
  if (input.getLastPress() === 'sound_toggle') audio.toggleSound();
}

function regenAndDecay() {
  if (state.pMana   < 100 && state.tickCount % GAIN_MANA_DELAY   === 0) state.pMana++;
  if (state.pEnergy >   3 && state.tickCount % LOSE_ENERGY_DELAY === 0) state.pEnergy--;
}
