import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

const ROOM = 'generale';
const HISTORY = 50;
const MAX_SHOWN = 200;
const NAME_KEY = 'epstein-island:chat-name';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const listEl = document.getElementById('chatList');
const formEl = document.getElementById('chatForm');
const nameInput = document.getElementById('chatName');
const textInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('chatSend');
const statusEl = document.getElementById('chatStatus');
const liveEl = document.getElementById('chatLive');

const seen = new Set();
let lastId = 0;
let me = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.error = String(isError);
}

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return created.user;
}

function formatTime(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function isNearBottom() {
  return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
}

function addMessage(message, { forceScroll = false } = {}) {
  if (!message || seen.has(message.id)) return;
  seen.add(message.id);
  lastId = Math.max(lastId, message.id);
  listEl.querySelector('.chat-empty')?.remove();
  const stick = forceScroll || isNearBottom() || message.user_id === me?.id;

  const item = document.createElement('article');
  item.className = 'chat-message';
  if (message.user_id === me?.id) item.classList.add('mine');
  const head = document.createElement('div');
  head.className = 'chat-message-head';
  const name = document.createElement('strong');
  name.textContent = message.player;
  const time = document.createElement('time');
  time.dateTime = message.created_at;
  time.textContent = formatTime(message.created_at);
  head.append(name, time);
  const body = document.createElement('p');
  body.textContent = message.body;
  item.append(head, body);
  listEl.append(item);

  while (listEl.children.length > MAX_SHOWN) listEl.firstElementChild.remove();
  if (stick) listEl.scrollTop = listEl.scrollHeight;
}

function showEmpty() {
  if (listEl.children.length) return;
  const empty = document.createElement('p');
  empty.className = 'chat-empty';
  empty.textContent = 'Ancora nessun messaggio. Scrivi il primo!';
  listEl.append(empty);
}

async function loadHistory() {
  const { data, error } = await supabase.from('chat_messages')
    .select('id, player, body, user_id, created_at')
    .eq('room', ROOM).order('id', { ascending: false }).limit(HISTORY);
  if (error) throw error;
  for (const message of data.reverse()) addMessage(message, { forceScroll: true });
  showEmpty();
}

async function pollNew() {
  try {
    const { data, error } = await supabase.from('chat_messages')
      .select('id, player, body, user_id, created_at')
      .eq('room', ROOM).gt('id', lastId).order('id', { ascending: true }).limit(100);
    if (error) throw error;
    for (const message of data) addMessage(message);
  } catch {
    /* il prossimo giro riprova */
  }
}

function subscribe() {
  supabase.channel(`chat-${ROOM}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${ROOM}` },
      (payload) => addMessage(payload.new))
    .subscribe((state) => {
      liveEl.textContent = state === 'SUBSCRIBED' ? 'In diretta' : 'Aggiornamento ogni 8 secondi';
    });
  // Rete di sicurezza: se il realtime non è attivo i messaggi arrivano comunque.
  setInterval(pollNew, 8000);
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const player = nameInput.value.trim();
  const body = textInput.value.trim();
  if (!player) return setStatus('Scegli un nome prima di scrivere.', true);
  if (!body) return;
  try { localStorage.setItem(NAME_KEY, player); } catch {}
  sendBtn.disabled = true;
  try {
    if (!me) me = await ensureSession();
    const { data, error } = await supabase.from('chat_messages')
      .insert({ room: ROOM, player, body }).select('id, player, body, user_id, created_at').single();
    if (error) throw error;
    addMessage(data, { forceScroll: true });
    textInput.value = '';
    setStatus('');
  } catch (error) {
    setStatus(`Messaggio non inviato: ${error.message || 'errore sconosciuto'}`, true);
  } finally {
    sendBtn.disabled = false;
    textInput.focus();
  }
});

try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch {}

(async () => {
  try {
    me = await ensureSession();
    await loadHistory();
    subscribe();
    setStatus('');
  } catch (error) {
    showEmpty();
    setStatus(`Chat non raggiungibile: ${error.message || 'errore sconosciuto'}`, true);
  }
})();
