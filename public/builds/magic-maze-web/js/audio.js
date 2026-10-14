// audio.js — Web Audio wrapper.
//
// Browsers require a user gesture to start an AudioContext, so we lazily
// create the context on the first call to unlockOnGesture() (wired from the
// initial keydown in input.js). Sample buffers stream in just after the
// gesture; until they're decoded, playSnd() silently no-ops — preferable to
// blocking input.

console.log('[audio.js] loaded');

const SAMPLES = {
  bonus: './assets/snd_bonus.wav',  // pickup chime, key turn, volume tick
  argh:  './assets/snd_argh.wav',   // monster death scream
  zap:   './assets/snd_zap.wav',    // attack spell launch / look-ahead
  punch: './assets/snd_punch.wav',  // monster hit on player
};

let ctx = null;
let masterGain = null;
const buffers = {};

let soundOn = true;
let volume = 0.7;             // 0..1, master gain
const VOLUME_STEP = 0.1;
const VOLUME_MAX = 1.0;
const VOLUME_MIN = 0.0;

// Called from the first user keydown. Synchronously creates the AudioContext
// (must happen *inside* the gesture handler in Chrome) and kicks off async
// buffer decoding. Safe to call repeatedly.
export function unlockOnGesture() {
  if (ctx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);
  if (ctx.state === 'suspended') ctx.resume();
  loadBuffers();
}

async function loadBuffers() {
  const entries = Object.entries(SAMPLES);
  await Promise.all(entries.map(async ([name, url]) => {
    try {
      const r = await fetch(url);
      const bytes = await r.arrayBuffer();
      buffers[name] = await ctx.decodeAudioData(bytes);
    } catch (err) {
      console.warn(`[audio.js] failed to load ${name}:`, err);
    }
  }));
}

export function playSnd(name) {
  if (!soundOn || !ctx || !buffers[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.connect(masterGain);
  src.start();
}

export function isSoundOn() { return soundOn; }
export function setSoundOn(on) { soundOn = !!on; }
export function toggleSound() { soundOn = !soundOn; }

export function getVolume() { return volume; }

export function incVolume() {
  volume = Math.min(VOLUME_MAX, volume + VOLUME_STEP);
  if (masterGain) masterGain.gain.value = volume;
  playSnd('bonus');           // audio feedback, matches MMAZE.PAS:402
}

export function decVolume() {
  volume = Math.max(VOLUME_MIN, volume - VOLUME_STEP);
  if (masterGain) masterGain.gain.value = volume;
  playSnd('bonus');
}
