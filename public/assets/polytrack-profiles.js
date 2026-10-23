const profilesKey = 'racing-zone-polytrack-profiles';
const activeProfileKey = 'racing-zone-polytrack-active-profile';
const gameFrame = document.getElementById('gameFrame');
const profileSelect = document.getElementById('localProfileSelect');
const createProfileForm = document.getElementById('createProfileForm');
const newProfileName = document.getElementById('newProfileName');
const status = document.getElementById('profileStatus');
let profiles = [];
let currentProfile;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

function saveProfiles() {
  try {
    localStorage.setItem(profilesKey, JSON.stringify(profiles));
    return true;
  } catch {
    setStatus('Non riesco a salvare i profili in questo browser.', true);
    return false;
  }
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
  } catch {
    setStatus('Non riesco ad attivare il profilo nel browser.', true);
    profileSelect.value = currentProfile.id;
    return;
  }

  currentProfile = nextProfile;
  document.body.dataset.polytrackProfile = currentProfile.id;
  profileSelect.value = currentProfile.id;
  setStatus(`Profilo ${currentProfile.name} attivo. Record e livree restano separati.`);

  if (gameFrame.hasAttribute('src')) {
    const reloadButton = document.getElementById('reloadBtn');
    if (!reloadButton.disabled) {
      reloadButton.click();
    } else {
      const gameUrl = new URL(gameFrame.src);
      gameUrl.searchParams.set('profile', currentProfile.id);
      gameFrame.src = gameUrl.href;
    }
  }
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
      const oldName = localStorage.getItem('racing-zone-polytrack-name');
      profiles = [{ id: 'default', name: oldName || 'Pilota 1' }];
      saveProfiles();
    }

    const savedProfileId = localStorage.getItem(activeProfileKey);
    currentProfile = profiles.find((profile) => profile.id === savedProfileId) || profiles[0];
    localStorage.setItem(activeProfileKey, currentProfile.id);
  } catch {
    setStatus('Non riesco a leggere i profili locali. Controlla le impostazioni del browser.', true);
    profileSelect.disabled = true;
    createProfileForm.querySelector('button').disabled = true;
    return false;
  }

  document.body.dataset.polytrackProfile = currentProfile.id;
  renderProfiles();
  return true;
}

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

initializeProfiles();
