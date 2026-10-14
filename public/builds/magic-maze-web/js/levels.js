// levels.js — fetch and parse a level JSON file.
//
// The extractor (see _temp/extract_assets.py) decoded the original 32 KB map
// files into a 128x128 grid where each tile is [A, B, blocked]:
//   A       — floor/wall sprite index (0..29) — passes to bgSheetIndex().
//   B       — foreground sprite index (0..57) — items, doors, keys, monsters,
//             exit. Passes to fgSheetIndex().
//   blocked — bit 7 of the original A byte. true = impassable wall.
//
// During load we walk the grid and pull every tile where 40 <= B < 60 into a
// separate `monsters` array, clearing that B byte on the map (matches
// MMAZE.PAS:259-266). M1 doesn't use the monsters array, but levels.js stays
// complete so M3 doesn't have to revisit it.

console.log('[levels.js] loaded');

const MONSTERS_FIRST = 40;
const MONSTERS_LAST = 60;       // exclusive

// Toughness table from MMAZE.PAS:69 — the per-monster-type starting energy.
const MONSTER_TOUGHNESS = [4,13,19,25,31,38,44,51,57,63,70,76,83,89,95,101,108,114,120,127];

// Load levels/index.json — used by the title-screen training selector.
export async function loadIndex() {
  const r = await fetch('./levels/index.json');
  if (!r.ok) throw new Error(`index.json: ${r.status}`);
  return r.json();
}

export async function load(n) {
  const file = `level${String(n).padStart(2, '0')}.json`;
  const resp = await fetch(`./levels/${file}`);
  if (!resp.ok) throw new Error(`${file}: ${resp.status}`);
  const raw = await resp.json();

  const tiles = raw.tiles;
  const monsters = [];
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      const b = t[1];
      if (b >= MONSTERS_FIRST && b < MONSTERS_LAST) {
        monsters.push({
          x, y,
          type: b - MONSTERS_FIRST,
          hp: MONSTER_TOUGHNESS[b - MONSTERS_FIRST],
          dir: 0,
        });
        t[1] = 0;
      }
    }
  }

  return {
    index: raw.index,
    name: raw.name,
    start: raw.start,
    defaultWall: raw.default_wall,
    lastLevel: raw.last_level,
    tiles,
    monsters,
  };
}

// Read one tile. Off-map returns the level's default wall, blocked.
// Matches MMAZE.PAS:434-462 (Map proc).
export function tile(level, x, y) {
  if (x < 0 || x > 127 || y < 0 || y > 127) {
    return [level.defaultWall, 0, true];
  }
  return level.tiles[y][x];
}
