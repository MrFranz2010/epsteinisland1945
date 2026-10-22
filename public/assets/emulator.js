const DB_NAME = 'EpsteinMultiGamesDB';
const STORE_NAME = 'roms';

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
    const store = tx.objectStore(STORE_NAME);
    store.put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDataFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteDataFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
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

  try {
    const savedData = await getDataFromDB('multiconsole_rom_data');
    if (savedData) {
      if (savedData.file) {
        currentRomFile = savedData.file;
        uploadLabel.textContent = `ROM salvata: ${savedData.file.name}`;
        playBtn.disabled = false;
        gameStatus.textContent = 'Dati caricati dalla memoria locale';
      }
      if (savedData.core) {
        consoleSelect.value = savedData.core;
      }
      if (savedData.touch !== undefined) {
        touchControlsToggle.value = savedData.touch.toString();
      }
    }
  } catch (err) {
    console.warn('Nessun dato salvato trovato.');
  }

  async function saveCurrentSettings() {
    if (currentRomFile) {
      await saveDataToDB('multiconsole_rom_data', {
        file: currentRomFile,
        core: consoleSelect.value,
        touch: touchControlsToggle.value === 'true'
      });
    }
  }

  romFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentRomFile = file;
    uploadLabel.textContent = `File selezionato: ${file.name}`;
    playBtn.disabled = false;
    gameStatus.textContent = 'Pronto all\'avvio';

    await saveCurrentSettings();
  });

  consoleSelect.addEventListener('change', saveCurrentSettings);
  touchControlsToggle.addEventListener('change', saveCurrentSettings);

  function launchEmulator() {
    if (!currentRomFile) return;

    placeholder.hidden = true;
    emulatorContainer.hidden = false;
    emulatorContainer.innerHTML = '<div id="game"></div>';
    reloadBtn.disabled = false;

    const romUrl = URL.createObjectURL(currentRomFile);
    const selectedCore = consoleSelect.value;
    const enableTouch = touchControlsToggle.value === 'true';

    window.EJS_player = '#game';
    window.EJS_core = selectedCore; 
    window.EJS_gameName = currentRomFile.name;
    window.EJS_color = '#0066cc';
    window.EJS_startOnLoaded = true;
    window.EJS_pathtoEJS = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_gameUrl = romUrl;
    window.EJS_saveDataInLocalStorage = true; 
    window.EJS_touchControls = enableTouch;

    if (typeof window.EJS_loadGame === 'function') {
      window.EJS_loadGame();
    } else if (typeof window.EJS_restart === 'function') {
      window.EJS_restart();
    } else {
      location.reload();
    }

    gameStatus.textContent = `In esecuzione (${selectedCore.toUpperCase()})`;
  }

  playBtn.addEventListener('click', launchEmulator);

  reloadBtn.addEventListener('click', () => {
    launchEmulator();
  });

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        gameStage.requestFullscreen().catch(err => {
          console.error(`Errore attivazione schermo intero: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      fullscreenBtn.setAttribute('aria-pressed', isFullscreen);
      if (fullscreenText) {
        fullscreenText.textContent = isFullscreen ? 'Esci schermo intero' : 'Schermo intero';
      }
    });
  }

  clearRomBtn.addEventListener('click', async () => {
    await deleteDataFromDB('multiconsole_rom_data');
    alert('Dati rimossi con successo.');
    location.reload();
  });
});