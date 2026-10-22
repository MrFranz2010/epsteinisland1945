import { submitScore, topScores } from './leaderboard.js';

const gameFrame = document.getElementById('gameFrame');
const trackInput = document.getElementById('lbTrack');
const playerEl = document.getElementById('lbPlayer');
const submitBtn = document.getElementById('lbSubmit');
const refreshBtn = document.getElementById('lbRefresh');
const statusEl = document.getElementById('lbStatus');
const listEl = document.getElementById('lbList');
let lastTimeMs = null;

function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

let autoTrack = null;

function slugify(text, max) {
  return text.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
}

function trackKey() {
  if (autoTrack && trackInput.value.trim() === autoTrack.name) return autoTrack.key;
  const slug = slugify(trackInput.value, 29);
  return slug ? `polytrack-${slug}` : '';
}

function playerName() {
  try {
    const id = localStorage.getItem('racing-zone-polytrack-active-profile');
    const profiles = JSON.parse(localStorage.getItem('racing-zone-polytrack-profiles') || '[]');
    const profile = profiles.find((entry) => entry.id === id);
    return (profile?.name || '').trim().slice(0, 20);
  } catch {
    return '';
  }
}

function showPlayer() {
  const name = playerName();
  playerEl.textContent = name ? `Giocatore: ${name} (cambialo da «Giocatore attivo» qui sopra)` : 'Nessun giocatore attivo.';
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.error = String(isError);
}

function save() {
  try {
    localStorage.setItem('epstein-island:pt-track', trackInput.value);
  } catch {}
}

async function refresh() {
  const key = trackKey();
  listEl.replaceChildren();
  if (!key) return setStatus('Scrivi il nome della pista per vedere la classifica.');
  try {
    const rows = await topScores(key, true, 10);
    if (!rows.length) return setStatus('Nessun tempo per questa pista: sii il primo.');
    for (const row of rows) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = row.player;
      const time = document.createElement('span');
      time.className = 'lobby-time';
      time.textContent = formatTime(row.score);
      li.append(name, time);
      listEl.append(li);
    }
    setStatus(`Classifica della pista «${trackInput.value.trim()}».`);
  } catch {
    setStatus('Classifica non raggiungibile al momento.', true);
  }
}

async function send() {
  const key = trackKey();
  const player = playerName();
  if (lastTimeMs === null) return setStatus('Termina prima una gara.', true);
  if (!key) return setStatus('Scrivi il nome della pista prima di inviare.', true);
  if (!player) return setStatus('Nessun giocatore attivo: creane uno nei profili.', true);
  save();
  setStatus(`Invio di ${formatTime(lastTimeMs)}…`);
  try {
    const improved = await submitScore(key, player, lastTimeMs, true);
    setStatus(improved ? `Nuovo record: ${formatTime(lastTimeMs)}!` : 'Il tuo record su questa pista è già migliore.');
    await refresh();
    lastTimeMs = null;
  } catch {
    setStatus('Non riesco a inviare il tempo. Riprova tra poco.', true);
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== gameFrame.contentWindow) return;
  const data = event.data;
  if (!data || data.type !== 'racing-zone:polytrack-finish' || !Number.isSafeInteger(data.timeMs)) return;
  lastTimeMs = data.timeMs;
  // Il gioco comunica nome e ID (hash) della pista: l'ID evita di confondere piste con lo stesso nome.
  if (typeof data.trackName === 'string' && data.trackName.trim()) {
    const name = data.trackName.trim().slice(0, 40);
    const idPart = typeof data.trackId === 'string' ? slugify(data.trackId, 6) : '';
    const base = slugify(name, idPart ? 22 : 29) || 'pista';
    autoTrack = { name, key: `polytrack-${base}${idPart ? `-${idPart}` : ''}` };
    trackInput.value = name;
    save();
  }
  if (trackKey()) send();
  else setStatus(`Gara terminata in ${formatTime(lastTimeMs)}. Scrivi il nome della pista e premi «Invia ultimo tempo».`);
});

try {
  trackInput.value = localStorage.getItem('epstein-island:pt-track') || '';
} catch {}
submitBtn.addEventListener('click', send);
refreshBtn.addEventListener('click', refresh);
trackInput.addEventListener('change', () => { save(); refresh(); });
document.addEventListener('change', (event) => { if (event.target.id === 'localProfileSelect') showPlayer(); });
window.addEventListener('storage', showPlayer);
showPlayer();
refresh();
