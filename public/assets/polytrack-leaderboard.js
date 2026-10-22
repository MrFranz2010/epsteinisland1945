import { submitScore, topScores } from './leaderboard.js';

const gameFrame = document.getElementById('gameFrame');
const trackInput = document.getElementById('lbTrack');
const nameInput = document.getElementById('lbName');
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

function trackKey() {
  const slug = trackInput.value.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 29);
  return slug ? `polytrack-${slug}` : '';
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.error = String(isError);
}

function save() {
  try {
    localStorage.setItem('epstein-island:pt-track', trackInput.value);
    localStorage.setItem('epstein-island:pt-name', nameInput.value);
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
  const player = nameInput.value.trim();
  if (lastTimeMs === null) return setStatus('Termina prima una gara.', true);
  if (!key || !player) return setStatus('Inserisci nome e pista prima di inviare.', true);
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
  if (trackKey() && nameInput.value.trim()) send();
  else setStatus(`Gara terminata in ${formatTime(lastTimeMs)}. Inserisci nome e pista, poi premi «Invia ultimo tempo».`);
});

try {
  trackInput.value = localStorage.getItem('epstein-island:pt-track') || '';
  nameInput.value = localStorage.getItem('epstein-island:pt-name') || '';
} catch {}
submitBtn.addEventListener('click', send);
refreshBtn.addEventListener('click', refresh);
trackInput.addEventListener('change', () => { save(); refresh(); });
nameInput.addEventListener('change', save);
refresh();
