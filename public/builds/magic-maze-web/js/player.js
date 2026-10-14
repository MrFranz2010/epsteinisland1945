// player.js — player-driven actions: item pickup at the standing tile, and
// arrow-key movement (with the door-unlock branch baked in).
//
// Source mapping:
//   pickupAtPlayerTile  ↔ MMAZE.PAS:662-680
//   handleMovement      ↔ MMAZE.PAS:684-687
//   tryMove             ↔ MMAZE.PAS:614-625

console.log('[player.js] loaded');

import * as input from './input.js';
import * as audio from './audio.js';
import { tile } from './levels.js';
import {
  state, clearTile,
  MOV_X, MOV_Y,
  C_KEYS, C_LOCKED_DOOR,
  C_CHEST, C_LIFE_POTION, C_MANA_POTION, C_MONEY_BAG, C_ORB, C_EXIT,
  CHEST_POINTS, MONEY_BAG_POINTS, MAX_KEYS_PER_COLOR,
} from './engine.js';

export function pickupAtPlayerTile() {
  const t = tile(state.level, state.px, state.py);
  const b = t[1];
  if (b === 0) return;

  // Keys (30..32). Cap at 3 per colour; over-cap pickups have no effect and
  // leave the key on the floor (matches MMAZE.PAS:663-668).
  if (b >= C_KEYS && b <= C_KEYS + 2) {
    const c = b - C_KEYS;
    if (state.keys[c] < MAX_KEYS_PER_COLOR) {
      state.keys[c]++;
      clearTile(state.px, state.py);
      audio.playSnd('bonus');
    }
    return;
  }

  switch (b) {
    case C_CHEST:
      state.score += CHEST_POINTS;
      clearTile(state.px, state.py);
      audio.playSnd('bonus');
      break;
    case C_LIFE_POTION:
      if (state.pEnergy < 75) {
        state.pEnergy += 25;
        clearTile(state.px, state.py);
        audio.playSnd('bonus');
      }
      break;
    case C_MANA_POTION:
      if (state.pMana < 80) {
        state.pMana += 20;
        clearTile(state.px, state.py);
        audio.playSnd('bonus');
      }
      break;
    case C_MONEY_BAG:
      state.score += MONEY_BAG_POINTS;
      clearTile(state.px, state.py);
      audio.playSnd('bonus');
      break;
    case C_ORB:
      if (state.pEnergy + state.pMana < 170) {
        state.pEnergy = 100;
        state.pMana = 100;
        clearTile(state.px, state.py);
        audio.playSnd('bonus');
      }
      break;
    case C_EXIT:
      state.levelExited = true;
      state.gameOver = true;
      break;
  }
}

export function handleMovement() {
  // Same Up/Right/Down/Left ordering as MMAZE.PAS:684-687. Last held key wins.
  if (input.isPressed('up'))    tryMove(0);
  if (input.isPressed('right')) tryMove(1);
  if (input.isPressed('down'))  tryMove(2);
  if (input.isPressed('left'))  tryMove(3);
}

// Turn-then-move. First press in a new direction turns; second steps. Locked
// doors consume a matching key and open into walkable floor.
function tryMove(dir) {
  if (state.pm !== dir) {
    state.pm = dir;
    return;
  }
  const nx = state.px + MOV_X[dir];
  const ny = state.py + MOV_Y[dir];
  const t = tile(state.level, nx, ny);
  const b = t[1], blocked = t[2];

  if (b >= C_LOCKED_DOOR && b <= C_LOCKED_DOOR + 2) {
    const c = b - C_LOCKED_DOOR;
    if (state.keys[c] > 0) {
      state.keys[c]--;
      clearTile(nx, ny);
      state.px = nx; state.py = ny;
      audio.playSnd('bonus');
    }
    return;
  }
  if (blocked) return;

  // Living monster blocks movement (MMAZE.PAS:604-605).
  for (const m of state.level.monsters) {
    if (m.hp > 0 && m.x === nx && m.y === ny) return;
  }

  state.px = nx; state.py = ny;
}
