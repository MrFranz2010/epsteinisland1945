// render.js — draws the current game state to a 320x200 backing buffer.
//
// Modes from engine state:
//   'title'           — title.png + 4-item menu
//   'trainingSelect'  — level list with cursor
//   'transition'      — fade-out / "Entering level N" / fade-in stack
//   'endSequence'     — LuciPer image then scrolling credits
//   'gameOverScreen'  — frozen play view + banner, awaits keypress
//   'play'            — gameplay viewport + HUD (M1/M2/M3 baseline)
//   'healing' / 'mana' — same as play, HUD spell icon shows the heal/mana sigil
//   'map'             — magic map replaces the gameplay viewport
//   'lookAhead'       — viewport follows the magic eye, eye sprite at centre
//   'help'            — full-screen help with speed slider
//   'confirm'         — game frozen, modal dialog overlay

console.log('[render.js] loaded');

import { tile } from './levels.js';
import {
  drawSprite, bgSheetIndex, fgSheetIndex,
  backImage, titleImage, endImage, paletteColor, meta, MAX_SPR,
} from './assets.js';
import { tickMsRef, TICK_MS_DEFAULT, TICK_MS_MIN, TICK_MS_MAX } from './modes.js';
import { TITLE_ITEMS, getCredits } from './flow.js';

const VIEW_PX = 16;
const VIEW_PY = 16;
const VIEW_SIZE = 160;
const TILE = 32;
const C_SPELL_BASE = 10;
const C_MONSTERS  = 40;
const C_EYE = 16;

// HUD layout (MMAZE.PAS:570-593, 574-584).
const SPELL_ICON_X = 180, SPELL_ICON_Y = 16;
const KEYS_X = 215, KEYS_Y = 16, KEY_STEP = 7;
const LIFE_X = 215, LIFE_Y = 57, BAR_H = 8;
const MANA_X = 215, MANA_Y = 65;
const SCORE_X = 215, SCORE_Y = 77, SCORE_W = 100, SCORE_H = 13;

// Magic-map layout (MMAZE.PAS:818-830).
const MAP_OX = 32, MAP_OY = 32, MAP_W = 128;

// Title menu layout (MMAZE.PAS:1147-1148).
const MENU_LX = 80, MENU_RX = 240, MENU_TY = 68;

// End-sequence credit colour keys → palette indices.
const CREDIT_COLORS = { 'K': 255, 'R': 20, 'G': 30, 'B': 40, '.': 0 };

let ctx = null;

export function init(canvas) {
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
}

export function draw(state) {
  if (!ctx) return;

  switch (state.mode) {
    case 'title':           drawTitleScreen(state);     return;
    case 'trainingSelect':  drawTrainingSelect(state);  return;
    case 'endSequence':     drawEndSequence(state);     return;
    case 'transition':      drawTransition(state);      return;
  }

  // Everything else needs a level to draw against.
  if (!state.level) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 200);
    return;
  }

  drawPlayFrame(state);

  if (state.mode === 'confirm' && state.modal) drawConfirm(state.modal);
  if (state.mode === 'help')                   drawHelpScreen(state);

  if (state.gameWon)       drawBanner('VICTORY!',  paletteColor(30));
  else if (state.gameOver) drawGameOverBanner(state);
}

// --- the play frame (gameplay + HUD) -----------------------------------

function drawPlayFrame(state) {
  // 1. UI chrome.
  const back = backImage();
  if (back) ctx.drawImage(back, 0, 0);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 200); }

  // 2. Gameplay region: viewport, magic map, or look-ahead view.
  if (state.mode === 'map') {
    drawMagicMap(state);
  } else {
    const vx = state.mode === 'lookAhead' ? state.lookAheadX : state.px;
    const vy = state.mode === 'lookAhead' ? state.lookAheadY : state.py;
    drawViewport(state, vx, vy);
    drawPlayer(state, vx, vy);
    drawMonsters(state, vx, vy);
    drawSpell(state, vx, vy);
    if (state.mode === 'lookAhead') drawEye();
  }

  // 3. HUD.
  drawSpellIcon(state);
  drawKeys(state);
  drawBars(state);
  drawScore(state);
}

// --- gameplay viewport --------------------------------------------------

function drawViewport(state, vx, vy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const wx = vx + dx;
      const wy = vy + dy;
      const sx = VIEW_PX + (dx + 2) * TILE;
      const sy = VIEW_PY + (dy + 2) * TILE;
      const t = tile(state.level, wx, wy);
      let a = t[0];
      const b = t[1];
      if (a === 0 && (wx & 2) === 2 && (wy & 2) === 2) a = 1;
      drawSprite(ctx, bgSheetIndex(a), sx, sy);
      if (b > 0 && b <= MAX_SPR) drawSprite(ctx, fgSheetIndex(b), sx, sy);
    }
  }
}

function drawPlayer(state, vx, vy) {
  const dx = state.px - vx;
  const dy = state.py - vy;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) return;
  const sx = VIEW_PX + (dx + 2) * TILE;
  const sy = VIEW_PY + (dy + 2) * TILE;
  drawSprite(ctx, fgSheetIndex(state.pm), sx, sy);
}

function drawMonsters(state, vx, vy) {
  for (const m of state.level.monsters) {
    if (m.hp <= 0) continue;
    const dx = m.x - vx;
    const dy = m.y - vy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) continue;
    const sx = VIEW_PX + (dx + 2) * TILE;
    const sy = VIEW_PY + (dy + 2) * TILE;
    drawSprite(ctx, fgSheetIndex(C_MONSTERS + m.type), sx, sy);
  }
}

function drawSpell(state, vx, vy) {
  const sp = state.spell;
  if (!sp) return;
  const dx = sp.x - vx;
  const dy = sp.y - vy;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) return;
  const sx = VIEW_PX + (dx + 2) * TILE;
  const sy = VIEW_PY + (dy + 2) * TILE;
  drawSprite(ctx, fgSheetIndex(C_SPELL_BASE + sp.type), sx, sy);
}

function drawEye() {
  drawSprite(ctx, fgSheetIndex(C_EYE), VIEW_PX + 2 * TILE, VIEW_PY + 2 * TILE);
}

// --- magic map ----------------------------------------------------------

function drawMagicMap(state) {
  ctx.fillStyle = '#000';
  ctx.fillRect(VIEW_PX, VIEW_PY, VIEW_SIZE, VIEW_SIZE);

  const palette = meta().palette;
  const wall = palette[255], door = palette[30], mon = palette[20];

  const img = ctx.createImageData(MAP_W, MAP_W);
  const buf = img.data;
  const tiles = state.level.tiles;
  for (let y = 0; y < MAP_W; y++) {
    const row = tiles[y];
    for (let x = 0; x < MAP_W; x++) {
      const t = row[x];
      const idx = (y * MAP_W + x) * 4;
      let r = 0, g = 0, b = 0;
      if (t[2])                          { r = wall[0]; g = wall[1]; b = wall[2]; }
      else if (t[1] >= 33 && t[1] <= 35) { r = door[0]; g = door[1]; b = door[2]; }
      buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255;
    }
  }
  for (const m of state.level.monsters) {
    if (m.hp <= 0) continue;
    const idx = (m.y * MAP_W + m.x) * 4;
    buf[idx] = mon[0]; buf[idx+1] = mon[1]; buf[idx+2] = mon[2];
  }
  ctx.putImageData(img, MAP_OX, MAP_OY);

  ctx.fillStyle = paletteColor(40);
  ctx.fillRect(MAP_OX - 1 + state.px, MAP_OY - 1 + state.py, 3, 3);
}

// --- HUD widgets --------------------------------------------------------

function drawSpellIcon(state) {
  drawSprite(ctx, fgSheetIndex(hudSpellSheetIndex(state)),
             SPELL_ICON_X, SPELL_ICON_Y);
}

function hudSpellSheetIndex(state) {
  switch (state.mode) {
    case 'map':       return C_SPELL_BASE + 3;
    case 'healing':   return C_SPELL_BASE + 4;
    case 'mana':      return C_SPELL_BASE + 5;
    case 'lookAhead': return C_SPELL_BASE + 6;
    default:          return C_SPELL_BASE + state.currentSpell;
  }
}

function drawKeys(state) {
  let x = KEYS_X;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < state.keys[c]; i++) {
      drawSprite(ctx, fgSheetIndex(30 + c), x, KEYS_Y);
      x += KEY_STEP;
    }
  }
}

function drawBars(state) {
  if (state.pEnergy > 0) {
    ctx.fillStyle = paletteColor(19);
    ctx.fillRect(LIFE_X, LIFE_Y, state.pEnergy, BAR_H);
  }
  if (state.pMana > 0) {
    ctx.fillStyle = paletteColor(38);
    ctx.fillRect(MANA_X, MANA_Y, state.pMana, BAR_H);
  }
}

function drawScore(state) {
  ctx.fillStyle = '#000';
  ctx.fillRect(SCORE_X, SCORE_Y, SCORE_W, SCORE_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(state.score), SCORE_X + SCORE_W - 2, SCORE_Y + 1);
  ctx.textAlign = 'start';
}

// --- title screen + menu ------------------------------------------------

function drawTitleScreen(state) {
  const img = titleImage();
  if (img) ctx.drawImage(img, 0, 0);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 200); }

  drawTitleMenu(state.titleCursor);
}

function drawTitleMenu(cursor) {
  const lowerY = MENU_TY + 4 * 16;
  ctx.fillStyle = '#000';
  ctx.fillRect(MENU_LX, MENU_TY, MENU_RX - MENU_LX, lowerY - MENU_TY);
  ctx.strokeStyle = paletteColor(7);
  ctx.lineWidth = 1;
  ctx.strokeRect(MENU_LX + 0.5, MENU_TY + 0.5,
                 MENU_RX - MENU_LX - 1, lowerY - MENU_TY - 1);

  ctx.fillStyle = paletteColor(9);
  ctx.font = 'bold 11px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < TITLE_ITEMS.length; i++) {
    ctx.fillText(TITLE_ITEMS[i], (MENU_LX + MENU_RX) / 2, MENU_TY + i * 16 + 2);
  }
  ctx.textAlign = 'start';

  // Highlight current cursor — accent rectangle.
  ctx.strokeStyle = paletteColor(10);
  ctx.lineWidth = 1;
  ctx.strokeRect(MENU_LX + 2.5, MENU_TY + cursor * 16 + 2.5,
                 MENU_RX - MENU_LX - 5, 14);
}

// --- training selector --------------------------------------------------

function drawTrainingSelect(state) {
  // Title image as backdrop.
  const img = titleImage();
  if (img) ctx.drawImage(img, 0, 0);
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 200); }

  const list = state.levelList || [];
  const lineH = 14;
  const cx = 160, top = 30;

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(40, top - 6, 240, list.length * lineH + 18);
  ctx.strokeStyle = paletteColor(7);
  ctx.lineWidth = 1;
  ctx.strokeRect(40.5, top - 5.5, 239, list.length * lineH + 17);

  ctx.fillStyle = paletteColor(9);
  ctx.font = 'bold 10px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TRAIN — pick a level', cx, top - 3);

  ctx.font = '10px "Lucida Console", Consolas, monospace';
  for (let i = 0; i < list.length; i++) {
    const sel = i === state.trainCursor;
    ctx.fillStyle = sel ? paletteColor(10) : paletteColor(7);
    const num = String(list[i].index).padStart(2, '0');
    ctx.fillText(`${num}: ${list[i].name}`, cx, top + 12 + i * lineH);
  }
  ctx.textAlign = 'start';
}

// --- level transition ---------------------------------------------------

function drawTransition(state) {
  const t = state.transition;
  if (!t) return;

  switch (t.phase) {
    case 'fadeOut1':
      drawPlayFrame(state);
      drawFadeOverlay(t.progress);
      break;
    case 'show':
      drawTransitionInfo(t);
      break;
    case 'fadeOut2':
      drawTransitionInfo(t);
      drawFadeOverlay(t.progress);
      break;
    case 'fadeIn':
      drawPlayFrame(state);
      drawFadeOverlay(1 - t.progress);
      break;
  }
}

function drawTransitionInfo(t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);

  const lvlText = `Entering level ${String(t.levelIndex).padStart(2, '0')}`;
  ctx.fillStyle = paletteColor(8);
  ctx.font = 'bold 12px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(lvlText, 160, 80);
  if (t.levelName) {
    ctx.fillStyle = paletteColor(9);
    ctx.font = '11px "Lucida Console", Consolas, monospace';
    ctx.fillText(t.levelName, 160, 100);
  }
  ctx.fillStyle = paletteColor(7);
  ctx.font = '9px "Lucida Console", Consolas, monospace';
  ctx.fillText('press any key', 160, 140);
  ctx.textAlign = 'start';
}

function drawFadeOverlay(alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${Math.min(1, alpha)})`;
  ctx.fillRect(0, 0, 320, 200);
}

// --- end sequence -------------------------------------------------------

function drawEndSequence(state) {
  if (!state.endSeq) return;

  if (state.endSeq.phase === 'image') {
    const img = endImage();
    if (img) ctx.drawImage(img, 0, 0);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 200); }
    // Pulse a "Good Bye!" line — Pascal does palette-cycling here; we just
    // draw the title text in stable colours.
    ctx.fillStyle = paletteColor(235);
    ctx.font = 'bold 14px "Lucida Console", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Good Bye!', 160, 4);
    const elapsed = performance.now() - state.endSeq.phaseStartMs;
    if (elapsed >= 1500) {
      ctx.fillStyle = paletteColor(7);
      ctx.font = '9px "Lucida Console", Consolas, monospace';
      ctx.fillText('press any key', 160, 188);
    }
    ctx.textAlign = 'start';
  } else {
    drawCredits(state);
  }
}

function drawCredits(state) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);

  const credits = getCredits();
  const lineH = 16;
  const baseY = 200;     // first line starts off the bottom edge
  const scrollY = state.endSeq.scrollY;

  ctx.font = 'bold 11px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < credits.length; i++) {
    const y = baseY + i * lineH - scrollY;
    if (y < -lineH || y > 200) continue;
    const [colorKey, text] = credits[i];
    if (text === '') continue;
    ctx.fillStyle = paletteColor(CREDIT_COLORS[colorKey] ?? 7);
    ctx.fillText(text, 160, y);
  }
  ctx.textAlign = 'start';
}

// --- modal + help -------------------------------------------------------

function drawConfirm(modal) {
  const x = 16, y = 48, w = 160, h = 96;
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = paletteColor(7);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = paletteColor(8);
  ctx.font = 'bold 10px "Lucida Console", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Do you want to', x + w / 2, y + 12);
  ctx.fillText(modal.text,        x + w / 2, y + 36);
  ctx.fillText('???',             x + w / 2, y + 60);
  ctx.fillText('[Y]es or [N]o?',  x + w / 2, y + 80);
  ctx.textAlign = 'start';
}

function drawHelpScreen() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);

  ctx.fillStyle = paletteColor(9);
  ctx.font = 'bold 11px "Lucida Console", Consolas, monospace';
  ctx.fillText(' Magic Maze HELP! (Esc returns to game)', 0, 0);
  ctx.strokeStyle = paletteColor(9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 14.5); ctx.lineTo(319, 14.5);
  ctx.stroke();

  ctx.fillStyle = paletteColor(7);
  ctx.font = '11px "Lucida Console", Consolas, monospace';
  const lines = [
    'Arrow keys move the old dude.',
    '',
    'CTRL :-  Fire attack spell',
    'ALT :-   Choose attack spell',
    '[F10] / Alt+Q :- Quit playing',
    '[H]: Heal          [M]: Magic Map',
    '[L]: Look ahead    [N]: Summon Mana',
    '[F9]: Restart level',
    '[F4]: Load game    [F5]: Save game',
    '[S]: Sound on/off',
    '[PgUp]/[PgDn]: Tune Volume',
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, (i + 1) * 14 + 1);
  }

  ctx.fillText('Speed:', 0, 180);
  ctx.fillText('Adjust with +/-', 180, 180);

  drawSpeedSlider();
}

function drawSpeedSlider() {
  const range = TICK_MS_MAX - TICK_MS_MIN;
  const x = 60, y = 180, w = 100, h = 19;

  ctx.strokeStyle = paletteColor(49);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);

  const defaultPos = Math.round((TICK_MS_DEFAULT - TICK_MS_MIN) / range * w);
  ctx.fillStyle = paletteColor(49);
  ctx.fillRect(x + defaultPos, y + 5, 1, 10);

  const currentPos = Math.round((tickMsRef.value - TICK_MS_MIN) / range * w);
  ctx.fillStyle = paletteColor(35);
  ctx.fillRect(x + currentPos, y, 1, h);
}

function drawBanner(text, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(20, 80, 152, 32);
  ctx.fillStyle = color;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 96, 90);
  ctx.textAlign = 'start';
}

function drawGameOverBanner(state) {
  drawBanner('GAME OVER', paletteColor(20));
  if (state.mode === 'gameOverScreen'
      && performance.now() - state.gameOverStartMs >= 1000) {
    ctx.fillStyle = paletteColor(7);
    ctx.font = '9px "Lucida Console", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('press any key', 96, 116);
    ctx.textAlign = 'start';
  }
}
