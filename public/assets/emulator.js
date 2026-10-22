const DB_NAME = 'EpsteinMultiGamesDB';
const STORE_NAME = 'roms';
const DATA_KEY = 'multiconsole_rom_data';
const AUTOSTART_KEY = 'retrogaming-autostart';
const EJS_PATH = 'https://cdn.emulatorjs.org/stable/data/';

// Alcuni valori del menu non coincidono con i nomi dei core di EmulatorJS.
const CORE_ALIASES = {
  megadrive: 'segaMD',
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDataToDB(key, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDataFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteDataFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const romFileInput = document.getElementById('romFileInput');
  const uploadLabel = document.getElementById('uploadLabel');
  const consoleSelect = document.getElementById('consoleSelect');
  const touchControlsToggle = document.getElementById('touchControlsToggle');
  const playBtn = document.getElementById('playBtn');
  const gameStatus = document.getElementById('gameStatus');
  const placeholder = document.getElementById('placeholder');
  const emulatorContainer = document.getElementById('emulatorContainer');
  const reloadBtn = document.getElementById('reloadBtn');
  const clearRomBtn = document.getElementById('clearRomBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fullscreenText = document.getElementById('fullscreenText');
  const gameStage = document.getElementById('gameStage');

  let currentRomFile = null;
  let emulatorStarted = false;

  // Recupera ROM e preferenze salvate
  try {
    const savedData = await getDataFromDB(DATA_KEY);
    if (savedData) {
      if (savedData.file) {
        currentRomFile = savedData.file;
        uploadLabel.textContent = `ROM salvata: ${savedData.file.name}`;
        playBtn.disabled = false;
        gameStatus.textContent = 'Dati caricati dalla memoria locale';
      }
      if (savedData.core) consoleSelect.value = savedData.core;
      if (savedData.touch !== undefined) touchControlsToggle.value = String(savedData.touch);
    }
  } catch (err) {
    console.warn('Nessun dato salvato trovato.', err);
  }

  async function saveCurrentSettings() {
    if (!currentRomFile) return;
    try {
      await saveDataToDB(DATA_KEY, {
        file: currentRomFile,
        core: consoleSelect.value,
        touch: touchControlsToggle.value === 'true',
      });
    } catch (err) {
      console.error('Impossibile salvare i dati locali.', err);
      gameStatus.textContent = 'ROM caricata, ma non salvabile nel browser';
    }
  }

  romFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentRomFile = file;
    uploadLabel.textContent = `File selezionato: ${file.name}`;
    playBtn.disabled = false;
    gameStatus.textContent = "Pronto all'avvio";
    await saveCurrentSettings();
  });

  consoleSelect.addEventListener('change', saveCurrentSettings);
  touchControlsToggle.addEventListener('change', saveCurrentSettings);

  function launchEmulator() {
    if (!currentRomFile) return;

    // EmulatorJS mantiene stato globale: per riavviare in modo affidabile
    // si ricarica la pagina e si riparte in automatico.
    if (emulatorStarted) {
      try { sessionStorage.setItem(AUTOSTART_KEY, '1'); } catch {}
      location.reload();
      return;
    }
    emulatorStarted = true;

    placeholder.hidden = true;
    emulatorContainer.hidden = false;
    emulatorContainer.innerHTML = '<div id="game"></div>';
    reloadBtn.disabled = false;

    const romUrl = URL.createObjectURL(currentRomFile);
    const selectedCore = CORE_ALIASES[consoleSelect.value] || consoleSelect.value;
    const enableTouch = touchControlsToggle.value === 'true';

    window.EJS_player = '#game';
    window.EJS_core = selectedCore;
    window.EJS_gameName = currentRomFile.name;
    window.EJS_color = '#0066cc';
    window.EJS_startOnLoaded = true;
    window.EJS_pathtoEJS = EJS_PATH;
    window.EJS_gameUrl = romUrl;
    window.EJS_threads = false;
    window.EJS_onGameStart = () => { gameStatus.textContent = 'In esecuzione'; };
    window.addEventListener('error', (e) => {
      gameStatus.textContent = `Errore: ${e.message}`;
    });
    window.EJS_touchControls = enableTouch;
    window.EJS_VirtualGamepadSettings = undefined;

    const script = document.createElement('script');
    script.src = `${EJS_PATH}loader.js`;
    script.onerror = () => {
      emulatorStarted = false;
      placeholder.hidden = false;
      emulatorContainer.hidden = true;
      gameStatus.textContent = 'Impossibile caricare EmulatorJS. Controlla la connessione.';
    };
    document.body.appendChild(script);

    gameStatus.textContent = `In esecuzione (${selectedCore.toUpperCase()})`;
  }

  playBtn.addEventListener('click', launchEmulator);
  reloadBtn.addEventListener('click', launchEmulator);

  // Riavvio automatico dopo "Ricarica gioco"
  let shouldAutostart = false;
  try {
    shouldAutostart = sessionStorage.getItem(AUTOSTART_KEY) === '1';
    sessionStorage.removeItem(AUTOSTART_KEY);
  } catch {}
  if (shouldAutostart && currentRomFile) launchEmulator();

  // Schermo intero
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        gameStage.requestFullscreen().catch((err) => {
          console.error(`Errore attivazione schermo intero: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      fullscreenBtn.setAttribute('aria-pressed', String(isFullscreen));
      if (fullscreenText) {
        fullscreenText.textContent = isFullscreen ? 'Esci schermo intero' : 'Schermo intero';
      }
    });
  }

  // Rimozione dati salvati
  clearRomBtn.addEventListener('click', async () => {
    try {
      await deleteDataFromDB(DATA_KEY);
      alert('Dati rimossi con successo.');
    } catch (err) {
      alert('Impossibile rimuovere i dati salvati.');
      console.error(err);
      return;
    }
    location.reload();
  });
});