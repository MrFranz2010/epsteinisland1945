// input.js — keyboard handler exposing two distinct concepts from the Pascal
// source:
//
//   isPressed(action) — "is this key currently held down?" (Pascal Key[scXxx])
//                       Used for movement, charging up heal/mana, etc.
//   lastPress         — "what was the most recent keydown?" (Pascal LastPress)
//                       Single-shot triggers — menu selection, cycle spell.
//                       Cleared after each game tick.
//
// Action names come from BRIEF.md decision #4 so future milestones (mobile,
// gamepad) only need to remap inputs to actions, not retouch the engine.

console.log('[input.js] loaded');

// One key may map to multiple actions (e.g. 'Enter' is both confirm AND cast).
// One action may have multiple keys.
const KEY_MAP = {
  ArrowUp:    ['up'],
  ArrowRight: ['right'],
  ArrowDown:  ['down'],
  ArrowLeft:  ['left'],
  Control:    ['cast'],
  Alt:        ['cycle_spell'],
  Tab:        ['cycle_2nd'],
  Space:      ['trigger_2nd', 'confirm'],
  KeyH:       ['heal'],
  KeyN:       ['mana', 'no'],     // 'no' answers a confirm dialog
  KeyM:       ['map'],
  KeyL:       ['look_ahead'],
  KeyS:       ['sound_toggle'],
  KeyY:       ['yes'],
  KeyQ:       ['no'],              // also dismisses confirm dialogs; Alt+Q = quit
  KeyK:       ['cheat_k'],
  KeyD:       ['cheat_d'],
  F1:         ['help'],
  F4:         ['load'],
  F5:         ['save'],
  F9:         ['restart'],
  F10:        ['quit'],             // single-key quit shortcut (Pascal scF10)
  PageUp:     ['vol_up'],
  PageDown:   ['vol_down'],
  Enter:      ['confirm', 'yes'],  // also accepts a confirm dialog
  Escape:     ['cancel'],
  NumpadAdd:      ['speed_up'],
  NumpadSubtract: ['speed_down'],
  Equal:          ['speed_up'],    // = key (shift gives + on US layout)
  Minus:          ['speed_down'],  // - key
};

// Resolve event.code first (layout-independent), then event.key for modifier
// names ('Control', 'Alt', 'Shift') which arrive as keys not codes.
function actionsFor(ev) {
  return KEY_MAP[ev.code] || KEY_MAP[ev.key] || [];
}

const held = new Set();
let lastPress = null;
let attached = false;
let onFirstGesture = null;     // called on the very first keydown (audio unlock)

export function attach(firstGestureCb) {
  if (attached) return;
  attached = true;
  onFirstGesture = firstGestureCb || null;
  window.addEventListener('keydown', (ev) => {
    if (onFirstGesture) { onFirstGesture(); onFirstGesture = null; }
    const actions = actionsFor(ev);
    if (!actions.length) return;
    ev.preventDefault();
    if (ev.repeat) return;
    for (const a of actions) held.add(a);
    lastPress = actions[0];
  });
  window.addEventListener('keyup', (ev) => {
    for (const a of actionsFor(ev)) held.delete(a);
  });
  window.addEventListener('blur', () => { held.clear(); });
}

export function isPressed(action) { return held.has(action); }
export function getLastPress() { return lastPress; }
export function consumeLastPress() { lastPress = null; }
