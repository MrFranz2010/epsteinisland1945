// assets.js — loads the sprite sheet and exposes blit helpers.
//
// The sheet is a single PNG laid out 16x6 with 32x32 tiles (88 sprites total).
// Per the original Pascal: special sprites occupy sheet indices 0..57
// (player facings, items, monsters, spells) and background sprites occupy
// 58..87 (floors and walls). Map tile A-bytes index BackSpr; B-bytes and the
// player-direction byte index Spr — translated here via fgSheetIndex /
// bgSheetIndex.

console.log('[assets.js] loaded');

// Pascal constants — must match _temp/MMAZE.PAS:62 and extract_assets.py:32-34
export const TILE = 32;
export const MAX_SPR = 57;       // foreground sprites 0..57
export const MAX_BG_SPR = 29;    // background sprites 0..29 (sheet 58..87)

const state = {
  meta: null,        // contents of sprites.json
  image: null,       // HTMLImageElement of sprites.png
  backImage: null,   // HTMLImageElement of back.png (in-game UI chrome)
  titleImage: null,  // HTMLImageElement of title.png (main menu background)
  endImage: null,    // HTMLImageElement of end.png (LuciPer end sequence)
};

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export async function load() {
  const metaResp = await fetch('./assets/sprites.json');
  if (!metaResp.ok) throw new Error(`sprites.json: ${metaResp.status}`);
  state.meta = await metaResp.json();

  [state.image, state.backImage, state.titleImage, state.endImage] = await Promise.all([
    loadImage('./assets/sprites.png'),
    loadImage('./assets/back.png'),
    loadImage('./assets/title.png'),
    loadImage('./assets/end.png'),
  ]);

  return state;
}

export function meta() { return state.meta; }
export function image() { return state.image; }
export function backImage() { return state.backImage; }
export function titleImage() { return state.titleImage; }
export function endImage() { return state.endImage; }

// Look up an RGB triple from the original VGA palette. Used for HUD widgets
// (life/mana bars, text) so colours match the Pascal source exactly.
export function paletteColor(idx) {
  const p = state.meta && state.meta.palette[idx];
  return p ? `rgb(${p[0]},${p[1]},${p[2]})` : '#fff';
}

// Map an A-byte (background, 0..29) or B-byte (foreground, 0..57) to its
// position on the shared sheet.
export function bgSheetIndex(a) { return 58 + a; }
export function fgSheetIndex(b) { return b; }

// Blit one 32x32 tile from the sheet to (dx,dy) in canvas space.
export function drawSprite(ctx, sheetIdx, dx, dy) {
  if (!state.image) return;
  const cols = state.meta.cols;
  const sx = (sheetIdx % cols) * TILE;
  const sy = Math.floor(sheetIdx / cols) * TILE;
  ctx.drawImage(state.image, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
}
