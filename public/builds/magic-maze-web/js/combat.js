// combat.js — attack spells (cast + flight) and monster behaviour.
//
// Source mapping:
//   handleSpellCast       ↔ MMAZE.PAS:696-718
//   moveSpell             ↔ MMAZE.PAS:721-728
//   monsterInteractions   ↔ MMAZE.PAS:730-749
//   moveMonsters / batches ↔ MMAZE.PAS:751-766
//   tryMoveMonster        ↔ MMAZE.PAS:627-656

console.log('[combat.js] loaded');

import * as input from './input.js';
import * as audio from './audio.js';
import { tile } from './levels.js';
import {
  state, pathBlocked,
  MOV_X, MOV_Y,
  C_BLOOD_SPLAT,
  SPELL_DAMAGE, SPELL_MANA_USE, SPELL_RANGE,
  PB_OPEN, PB_MONSTER,
  MON_DELAY, MONSTER_POINTS,
} from './engine.js';

// --- spells -------------------------------------------------------------

export function handleSpellCast() {
  if (!input.isPressed('cast')) return;
  const t = state.currentSpell;
  // Pascal's strict > comparison (MMAZE.PAS:700) means the caster always
  // keeps at least 1 mana after casting. SpellPow<2 means no in-flight spell,
  // or one in its impact frame.
  if (state.pMana <= SPELL_MANA_USE[t]) return;
  if (state.spell && state.spell.power >= 2) return;
  state.pMana -= SPELL_MANA_USE[t];
  state.spell = {
    type: t,
    x: state.px,
    y: state.py,
    dir: state.pm,
    power: SPELL_RANGE[t],
  };
  audio.playSnd('zap');
}

export function moveSpell() {
  if (!state.spell) return;
  const sp = state.spell;
  sp.power--;
  sp.x += MOV_X[sp.dir];
  sp.y += MOV_Y[sp.dir];
  // Walls / locked doors / player block. Monsters do not — the spell-hit
  // pass damages a monster and clears the spell separately.
  const pb = pathBlocked(sp.x, sp.y);
  if (pb !== PB_OPEN && pb !== PB_MONSTER && sp.power > 0) {
    sp.power = 1;          // render one impact frame, then despawn next tick
  }
  if (sp.power <= 0) state.spell = null;
}

// --- monster interactions (player damage + spell hits) ------------------

export function monsterInteractions() {
  const monsters = state.level.monsters;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.hp <= 0) continue;

    // Cardinal-adjacent monster drains 1 energy/tick. Diagonal contact does
    // NOT drain (MMAZE.PAS:733-736).
    const dx = Math.abs(m.x - state.px);
    const dy = Math.abs(m.y - state.py);
    if (dx < 2 && dy < 2 && (dx === 0 || dy === 0)) {
      state.pEnergy--;
      audio.playSnd('punch');
    }

    // Spell hit — only while spell is still flying (power > 1) so the impact
    // frame doesn't double-tap. First monster on the spell tile takes the
    // damage; the spell collapses to its impact frame for one render.
    if (state.spell && state.spell.power > 1
        && m.x === state.spell.x && m.y === state.spell.y) {
      m.hp -= SPELL_DAMAGE[state.spell.type];
      state.spell.power = 1;
      if (m.hp < 1) killMonster(m);
    }
  }
}

function killMonster(m) {
  m.hp = 0;
  state.score += MONSTER_POINTS;
  audio.playSnd('argh');
  // Drop a blood splat where the monster died, but only if the tile was empty
  // (MMAZE.PAS:744-746) — don't paint over keys/chests/doors.
  const t = tile(state.level, m.x, m.y);
  if (t[1] === 0) state.level.tiles[m.y][m.x][1] = C_BLOOD_SPLAT;
}

// --- monster AI ---------------------------------------------------------
//
// Staggered across 8 ticks so each monster moves once per ~0.8 s. MonWait
// cycles 0,1,…,7 then resets to 0; Pascal maps these values to batch indices
// in a non-obvious order: 0→0, 1→7, 2→6, … 7→1.
export function moveMonsters() {
  const monsters = state.level.monsters;
  const n = monsters.length;
  if (n === 0) return;
  if (state.monWait > MON_DELAY) state.monWait = 0;
  const batch = state.monWait === 0 ? 0 : 8 - state.monWait;
  const lo = Math.floor(batch * n / 8);
  const hi = Math.floor((batch + 1) * n / 8);
  for (let i = lo; i < hi; i++) tryMoveMonster(monsters[i]);
  state.monWait++;
}

// Score each direction and pick the highest non-zero (MMAZE.PAS:627-656).
function tryMoveMonster(m) {
  if (m.hp <= 0) return;
  const jp = [0, 0, 0, 0];
  for (let j = 0; j < 4; j++) jp[j] = 175 + Math.floor(Math.random() * 35);

  // Vertical bias — only one branch fires (the IF/ELSE chain in Pascal).
  if (state.py < m.y)      { jp[0] += 1000; jp[2] -= 200; }
  else if (state.py > m.y) { jp[2] += 1000; jp[0] -= 200; }

  // Horizontal bias. Note the source compares px>MonX first (right) then
  // px<MonX (left) — port the order verbatim.
  if (state.px > m.x)      { jp[1] += 1000; jp[3] -= 200; }
  else if (state.px < m.x) { jp[3] += 1000; jp[1] -= 200; }

  let best = -3000, dir = -1;
  for (let j = 0; j < 4; j++) {
    if (j === m.dir) jp[j] += 15;        // momentum: prefer current heading
    if (pathBlocked(m.x + MOV_X[j], m.y + MOV_Y[j]) !== PB_OPEN) jp[j] = 0;
    if (jp[j] > best) { best = jp[j]; dir = j; }
  }
  if (best > 0 && dir >= 0) {
    m.x += MOV_X[dir];
    m.y += MOV_Y[dir];
    m.dir = dir;
  }
}
