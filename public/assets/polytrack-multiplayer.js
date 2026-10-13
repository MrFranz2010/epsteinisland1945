const endpoint = '/api/polytrack/lobbies';
const profilesKey = 'racing-zone-polytrack-profiles';
const activeProfileKey = 'racing-zone-polytrack-active-profile';
const gameFrame = document.getElementById('gameFrame');
const createForm = document.getElementById('createLobbyForm');
const joinForm = document.getElementById('joinLobbyForm');
const createProfileForm = document.getElementById('createProfileForm');
const nameInput = document.getElementById('playerName');
const codeInput = document.getElementById('lobbyCode');
const profileSelect = document.getElementById('localProfileSelect');
const newProfileName = document.getElementById('newProfileName');
const forms = document.getElementById('lobbyForms');
const lobbyRoom = document.getElementById('lobbyRoom');
const lobbyStatus = document.getElementById('lobbyStatus');
const leaderboard = document.getElementById('lobbyLeaderboard');
const codeDisplay = document.getElementById('lobbyCodeDisplay');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
let activeLobby = null;
let refreshInProgress = false;
let profiles = [];
let currentProfile = null;

function setStatus(message, isError = false) {
  lobbyStatus.textContent = message;
  lobbyStatus.dataset.error = String(isError);
}

function profileNameKey(profileId) {
  return `racing-zone-polytrack-profile:${profileId}:name`;
}

function profileLobbyKey(profileId) {
  return `racing-zone-polytrack-profile:${profileId}:lobby`;
}

function saveProfiles() {
  try {
    localStorage.setItem(profilesKey, JSON.stringify(profiles));
  } catch {
    setStatus('Non riesco a salvare i profili in questo browser. Controlla lo spazio disponibile.', true);
    return false;
  }
  return true;
}

function renderProfiles() {
  profileSelect.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    profileSelect.append(option);
  }
  profileSelect.value = currentProfile.id;
}

function restoreProfileLobby() {
  let savedLobby;
  try {
    savedLobby = JSON.parse(localStorage.getItem(profileLobbyKey(currentProfile.id)) || 'null');
  } catch {
    localStorage.removeItem(profileLobbyKey(currentProfile.id));
    setStatus('I dati della lobby salvati per questo profilo non sono validi.', true);
    return;
  }
  if (!savedLobby || typeof savedLobby.code !== 'string' || typeof savedLobby.playerId !== 'string' || typeof savedLobby.token !== 'string') {
    lobbyRoom.hidden = true;
    forms.hidden = false;
    return;
  }
  activeLobby = savedLobby;
  renderRoom({
    code: savedLobby.code,
    playerId: savedLobby.playerId,
    members: [{ id: savedLobby.playerId, name: nameInput.value || currentProfile.name, bestTimeMs: null }],
  });
  setStatus('Ripristino della lobby…');
  refreshLobby();
}

function switchProfile(profileId) {
  const nextProfile = profiles.find((profile) => profile.id === profileId);
  if (!nextProfile || nextProfile.id === currentProfile.id) return;
  const gameIsRunning = gameFrame.hasAttribute('src') && !gameFrame.hidden;
  if (gameIsRunning && !window.confirm('Cambiare giocatore ricarica PolyTrack e interrompe la gara in corso. Continuare?')) {
    profileSelect.value = currentProfile.id;
    return;
  }
  try {
    localStorage.setItem(activeProfileKey, nextProfile.id);
    nameInput.value = localStorage.getItem(profileNameKey(nextProfile.id)) || nextProfile.name;
  } catch {
    setStatus('Non riesco ad attivare il profilo nel browser.', true);
    profileSelect.value = currentProfile.id;
    return;
  }
  currentProfile = nextProfile;
  document.body.dataset.polytrackProfile = currentProfile.id;
  profileSelect.value = currentProfile.id;
  activeLobby = null;
  lobbyRoom.hidden = true;
  forms.hidden = false;
  restoreProfileLobby();

  if (gameFrame.hasAttribute('src')) {
    if (!document.getElementById('reloadBtn').disabled) {
      document.getElementById('reloadBtn').click();
    } else {
      const gameUrl = new URL(gameFrame.src);
      gameUrl.searchParams.set('profile', currentProfile.id);
      gameFrame.src = gameUrl.href;
    }
  }
  setStatus(`Profilo ${currentProfile.name} attivo: record e livree sono separati dagli altri giocatori.`);
}

function initializeProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(profilesKey) || 'null');
    profiles = Array.isArray(saved)
      ? saved.filter((profile) => profile
        && typeof profile.id === 'string'
        && /^[A-Za-z0-9_-]{1,80}$/.test(profile.id)
        && typeof profile.name === 'string'
        && profile.name.trim().length > 0
        && profile.name.length <= 20)
      : [];
    if (profiles.length === 0) {
      const existingName = localStorage.getItem('racing-zone-polytrack-name');
      profiles = [{ id: 'default', name: existingName || 'Pilota 1' }];
      const existingLobby = localStorage.getItem('racing-zone-polytrack-lobby');
      if (existingLobby && !localStorage.getItem(profileLobbyKey('default'))) {
        localStorage.setItem(profileLobbyKey('default'), existingLobby);
      }
      if (!saveProfiles()) return false;
    }
    const savedProfileId = localStorage.getItem(activeProfileKey);
    currentProfile = profiles.find((profile) => profile.id === savedProfileId) || profiles[0];
    localStorage.setItem(activeProfileKey, currentProfile.id);
    const savedName = localStorage.getItem(profileNameKey(currentProfile.id));
    if (!savedName) localStorage.setItem(profileNameKey(currentProfile.id), currentProfile.name);
  } catch {
    setStatus('Non riesco a leggere i profili locali. Controlla le impostazioni di archiviazione del browser.', true);
    return false;
  }

  document.body.dataset.polytrackProfile = currentProfile.id;
  nameInput.value = localStorage.getItem(profileNameKey(currentProfile.id)) || currentProfile.name;
  renderProfiles();
  return true;
}

async function request(url, options) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || `Richiesta non riuscita (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function saveLobby(lobby) {
  try {
    localStorage.setItem(profileLobbyKey(currentProfile.id), JSON.stringify(lobby));
    return true;
  } catch {
    return false;
  }
}

function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function renderRoom(room) {
  codeDisplay.textContent = room.code;
  leaderboard.replaceChildren();
  for (const member of room.members) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${member.name}${member.id === room.playerId ? ' (tu)' : ''}`;
    const time = document.createElement('span');
    time.className = 'lobby-time';
    time.textContent = member.bestTimeMs === null ? 'In attesa' : formatTime(member.bestTimeMs);
    row.append(name, time);
    leaderboard.append(row);
  }
  forms.hidden = true;
  lobbyRoom.hidden = false;
}

async function activateLobby(lobby, message) {
  activeLobby = lobby;
  renderRoom(lobby);
  const saved = saveLobby(lobby);
  setStatus(saved
    ? message
    : 'Lobby attiva, ma il browser non può salvarne l’accesso. Non ricaricare questa pagina.',
  !saved);
  await refreshLobby();
}

async function refreshLobby() {
  if (!activeLobby || refreshInProgress) return;
  refreshInProgress = true;
  const lobby = activeLobby;
  try {
    const room = await sendAction('read', { code: lobby.code, token: lobby.token });
    if (activeLobby !== lobby) return;
    renderRoom(room);
  } catch (error) {
    if (activeLobby === lobby) {
      setStatus(error.message, true);
      if ([403, 404, 410].includes(error.status)) {
        activeLobby = null;
        localStorage.removeItem(profileLobbyKey(currentProfile.id));
        lobbyRoom.hidden = true;
        forms.hidden = false;
      }
    }
  } finally {
    refreshInProgress = false;
  }
}

async function sendAction(action, values) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ action, ...values }),
  });
}

function getPlayerName() {
  const name = nameInput.value.trim();
  if (name) {
    try {
      localStorage.setItem(profileNameKey(currentProfile.id), name);
    } catch {
      setStatus('Il browser non può salvare il tuo nome. Controlla le impostazioni di archiviazione.', true);
      return '';
    }
  }
  return name;
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = getPlayerName();
  if (!name) {
    setStatus('Inserisci il tuo nome prima di creare la lobby.', true);
    return;
  }
  setStatus('Creazione della lobby…');
  try {
    const result = await sendAction('create', { name });
    await activateLobby(result, 'Lobby creata. Copia il codice e invialo ai tuoi amici.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

profileSelect.addEventListener('change', () => switchProfile(profileSelect.value));

createProfileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = newProfileName.value.trim();
  if (!name || name.length > 20) {
    setStatus('Il nome del profilo deve contenere da 1 a 20 caratteri.', true);
    return;
  }
  const profile = { id: crypto.randomUUID(), name };
  profiles.push(profile);
  if (!saveProfiles()) {
    profiles.pop();
    return;
  }
  newProfileName.value = '';
  renderProfiles();
  switchProfile(profile.id);
});

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = getPlayerName();
  if (!name) {
    setStatus('Inserisci il tuo nome prima di unirti alla lobby.', true);
    return;
  }
  setStatus('Accesso alla lobby…');
  try {
    const result = await sendAction('join', { code: codeInput.value, name });
    await activateLobby(result, 'Sei nella lobby. Avvia PolyTrack e termina una gara per registrare il tuo tempo.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

copyInviteBtn.addEventListener('click', async () => {
  if (!activeLobby) return;
  const inviteUrl = new URL(location.href);
  inviteUrl.searchParams.set('lobby', activeLobby.code);
  try {
    await navigator.clipboard.writeText(inviteUrl.href);
    setStatus('Link d’invito copiato. Puoi anche condividere il codice mostrato qui sopra.');
  } catch {
    setStatus(`Non riesco a copiare il link. Condividi il codice ${activeLobby.code} ai tuoi amici.`);
  }
});

leaveLobbyBtn.addEventListener('click', async () => {
  if (!activeLobby) return;
  const lobby = activeLobby;
  setStatus('Uscita dalla lobby…');
  try {
    await sendAction('leave', { code: lobby.code, token: lobby.token });
    activeLobby = null;
    localStorage.removeItem(profileLobbyKey(currentProfile.id));
    lobbyRoom.hidden = true;
    forms.hidden = false;
    setStatus('Hai lasciato la lobby. Puoi crearne una nuova o unirti a un’altra.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

window.addEventListener('message', async (event) => {
  if (event.origin !== location.origin || event.source !== gameFrame.contentWindow) return;
  const result = event.data;
  if (!result || result.type !== 'racing-zone:polytrack-finish' || !Number.isSafeInteger(result.timeMs)) return;
  if (!activeLobby) {
    setStatus(`Gara terminata in ${formatTime(result.timeMs)}. Crea una lobby o unisciti a una per condividere il tempo.`);
    return;
  }
  setStatus(`Invio del tempo ${formatTime(result.timeMs)}…`);
  try {
    const response = await sendAction('score', {
      code: activeLobby.code,
      token: activeLobby.token,
      timeMs: result.timeMs,
    });
    renderRoom(response);
    setStatus(response.updated
      ? `Nuovo record registrato: ${formatTime(result.timeMs)}!`
      : `Tempo ${formatTime(result.timeMs)} registrato; il tuo record resta ${formatTime(response.members.find((member) => member.id === response.playerId).bestTimeMs)}.`);
  } catch (error) {
    setStatus(`Non riesco a registrare il tempo: ${error.message}`, true);
  }
});

if (initializeProfiles()) restoreProfileLobby();
else {
  profileSelect.disabled = true;
  createProfileForm.querySelector('button').disabled = true;
  createForm.querySelector('button').disabled = true;
  joinForm.querySelector('button').disabled = true;
}
const invitedCode = new URL(location.href).searchParams.get('lobby');
if (invitedCode) codeInput.value = invitedCode.toUpperCase();

setInterval(refreshLobby, 5000);
