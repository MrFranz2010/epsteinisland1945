const SEARX_INSTANCES = [
  "https://searx.be",
  "https://paulgo.io",
  "https://search.ononoki.org",
  "https://searx.nameclue.net"
];
const COBALT_API = "https://api.cobalt.tools/api/json";
const LIBRARY_KEY = "epstein-island-music-library-v1";

const searchForm = document.querySelector("#musicSearchForm");
const queryInput = document.querySelector("#musicQuery");
const suggestions = document.querySelector("#musicSuggestions");
const navButtons = [...document.querySelectorAll(".music-nav-button")];
const viewEyebrow = document.querySelector("#musicViewEyebrow");
const viewTitle = document.querySelector("#musicViewTitle");
const filters = document.querySelector("#musicFilters");
const status = document.querySelector("#musicStatus");
const results = document.querySelector("#musicResults");
const homePlaylistsSection = document.querySelector("#homePlaylistsSection");
const homePlaylists = document.querySelector("#homePlaylists");
const homePlaylistCount = document.querySelector("#homePlaylistCount");
const frame = document.querySelector("#musicFrame");
const audio = document.querySelector("#musicAudio");
const playerPlaceholder = document.querySelector("#playerPlaceholder");
const playerArtwork = document.querySelector("#playerArtwork");
const playerHeading = document.querySelector("#playerHeading");
const playerArtist = document.querySelector("#playerArtist");
const playerOpenLink = document.querySelector("#playerOpenLink");
const playerNote = document.querySelector("#musicPlayerNote");
const playerPanel = document.querySelector(".music-player-panel");
const spotifyImport = document.querySelector("#spotifyImport");
const spotifyForm = document.querySelector("#spotifyForm");
const spotifyUrlInput = document.querySelector("#spotifyUrl");
const spotifyStatus = document.querySelector("#spotifyStatus");
const spotifyConvertForm = document.querySelector("#spotifyConvertForm");
const spotifyConvertUrl = document.querySelector("#spotifyConvertUrl");
const spotifyTrackList = document.querySelector("#spotifyTrackList");
const spotifyCsvInput = document.querySelector("#spotifyCsvFile");
const spotifyConvertStatus = document.querySelector("#spotifyConvertStatus");
const queueControls = document.querySelector("#musicQueueControls");
const queuePosition = document.querySelector("#queuePosition");
const previousTrackButton = document.querySelector("#previousTrack");
const nextTrackButton = document.querySelector("#nextTrack");
const repeatQueueButton = document.querySelector("#repeatQueue");
const shuffleQueueButton = document.querySelector("#shuffleQueue");
const playerLoadStatus = document.querySelector("#playerLoadStatus");

let activeView = "home";
let searchFilter = "music_songs";
let currentQuery = "";
let suggestionTimer;
let suggestionRequest = 0;
let library = loadLibrary();
let playbackQueue = [];
let playbackOrder = [];
let playbackQueueIndex = -1;
let repeatMode = "off";
let shuffleEnabled = false;
let playerLoadTimer;
let playbackRequestId = 0;

frame.addEventListener("load", () => {
  if (!frame.src.startsWith("https://")) return;
  clearTimeout(playerLoadTimer);
  playerLoadStatus.hidden = true;
});

audio.addEventListener("ended", () => {
  if (playbackQueueIndex < 0) return;
  if (repeatMode === "one") {
    audio.currentTime = 0;
    audio.play().catch(() => setStatus("Premi play per ripetere il brano."));
    return;
  }
  if (playbackQueueIndex < playbackOrder.length - 1) {
    playQueueTrack(playbackQueueIndex + 1);
  } else if (repeatMode === "all") {
    playQueueTrack(0);
  } else {
    setStatus("Playlist terminata.");
  }
});

audio.addEventListener("error", () => {
  if (audio.hidden) return;
  playerLoadStatus.textContent = "Lo stream audio non è disponibile. Prova il link Apri ↗.";
  playerLoadStatus.hidden = false;
  setStatus("Errore durante il caricamento del brano.", true);
});

function loadLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && item.id && item.title) : [];
  } catch {
    return [];
  }
}

function saveLibrary() {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch {
    setStatus("La raccolta non può essere salvata su questo dispositivo.", true);
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  if (isError) status.dataset.error = "true";
  else delete status.dataset.error;
}

async function fetchSearx(query) {
  let lastError;
  for (const instance of SEARX_INSTANCES) {
    try {
      const url = new URL("/search", instance);
      url.searchParams.set("q", query);
      url.searchParams.set("engines", "youtube");
      url.searchParams.set("format", "json");

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`SearXNG HTTP ${response.status}`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("SearXNG non disponibile");
}

async function fetchCobaltStream(videoId) {
  const response = await fetch(COBALT_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      downloadMode: "audio",
      audioFormat: "mp3"
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Cobalt API HTTP error");
  const data = await response.json();
  if (data.url) return data.url;
  if (data.picker && data.picker.length > 0) return data.picker[0].url;
  throw new Error("Stream non disponibile tramite Cobalt");
}

function parseYoutubeLink(value) {
  const trimmedValue = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmedValue)) {
    return { videoId: trimmedValue, playlistId: "" };
  }

  let url;
  try {
    url = new URL(trimmedValue);
  } catch {
    return null;
  }

  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
  ]);
  if (!allowedHosts.has(url.hostname)) return null;

  let videoId = url.searchParams.get("v") || "";
  if (url.hostname.endsWith("youtu.be")) {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (!videoId) {
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(pathParts[0])) {
      videoId = pathParts[1] || "";
    }
  }

  const playlistId = url.searchParams.get("list") || "";
  if (videoId && !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  if (playlistId && !/^[A-Za-z0-9_-]{10,}$/.test(playlistId)) return null;
  if (!videoId && !playlistId) return null;
  return { videoId, playlistId };
}

function parseSpotifyPlaylist(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
  const pathParts = url.pathname.split("/").filter(Boolean);
  const playlistIndex = pathParts.indexOf("playlist");
  const playlistId = playlistIndex >= 0 ? pathParts[playlistIndex + 1] : "";
  return /^[A-Za-z0-9]{22}$/.test(playlistId) ? playlistId : null;
}

function normalizeSearxItem(result) {
  if (!result || !result.url) return null;
  const media = parseYoutubeLink(result.url);
  if (!media || !media.videoId) return null;

  let thumbnail = "";
  try {
    const thumb = result.img_src || result.thumbnail || "";
    const candidate = new URL(thumb, "https://youtube.com");
    if (candidate.protocol === "https:") thumbnail = candidate.href;
  } catch {
    thumbnail = "";
  }

  return {
    id: media.videoId,
    videoId: media.videoId,
    playlistId: "",
    type: "stream",
    provider: "searx",
    title: result.title || "Senza titolo",
    uploader: result.author || result.template || "YouTube",
    thumbnail,
  };
}

function itemKey(item) {
  return `${item.type}:${item.id}`;
}

function isSaved(item) {
  return library.some((saved) => itemKey(saved) === itemKey(item));
}

function updateNavigation(view) {
  activeView = view;
  for (const button of navButtons) {
    const selected = button.dataset.view === view;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

function showFilters(visible) {
  filters.hidden = !visible;
  for (const button of filters.querySelectorAll("[data-filter]")) {
    const selected = button.dataset.filter === searchFilter;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function updateQueueControls() {
  const hasQueue = playbackQueue.length > 0;
  queueControls.hidden = !hasQueue;
  if (!hasQueue) return;
  queuePosition.textContent = `${playbackQueueIndex + 1} / ${playbackOrder.length}`;
  previousTrackButton.disabled = playbackQueueIndex <= 0 && repeatMode !== "all";
  nextTrackButton.disabled = playbackQueueIndex >= playbackOrder.length - 1 && repeatMode !== "all";
  repeatQueueButton.dataset.mode = repeatMode;
  repeatQueueButton.textContent = repeatMode === "one" ? "↻¹" : "↻";
  repeatQueueButton.setAttribute("aria-label", `Ripetizione ${repeatMode === "off" ? "disattivata" : repeatMode === "one" ? "brano" : "playlist"}`);
  repeatQueueButton.title = `Ripetizione: ${repeatMode === "off" ? "disattivata" : repeatMode === "one" ? "brano" : "playlist"}`;
  shuffleQueueButton.setAttribute("aria-pressed", String(shuffleEnabled));
  shuffleQueueButton.setAttribute("aria-label", shuffleEnabled ? "Disattiva riproduzione casuale" : "Attiva riproduzione casuale");
  shuffleQueueButton.title = shuffleEnabled ? "Disattiva casuale" : "Attiva casuale";
  shuffleQueueButton.classList.toggle("is-active", shuffleEnabled);
}

function playItem(item) {
  if (item.type === "converted-playlist") {
    playbackQueue = Array.isArray(item.tracks) ? item.tracks : [];
    if (!playbackQueue.length) {
      setStatus("Questa playlist convertita non contiene brani riproducibili.", true);
      return;
    }
    playbackOrder = playbackQueue.map((_, index) => index);
    if (shuffleEnabled) shuffleRemainingTracks(0);
    playQueueTrack(0);
    return;
  }

  if (item.provider !== "spotify" && item.type === "stream") {
    playbackQueue = [item];
    playbackOrder = [0];
    playbackQueueIndex = 0;
  } else {
    playbackQueue = [];
    playbackOrder = [];
    playbackQueueIndex = -1;
  }
  updateQueueControls();
  playMediaItem(item);
}

function playQueueTrack(index) {
  if (index < 0 || index >= playbackOrder.length) return;
  playbackQueueIndex = index;
  playMediaItem(playbackQueue[playbackOrder[index]]);
  updateQueueControls();
}

function shuffleRemainingTracks(currentPosition) {
  const currentTrack = playbackOrder[currentPosition];
  const remaining = playbackOrder.filter((trackIndex) => trackIndex !== currentTrack);
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  playbackOrder = [currentTrack, ...remaining];
}

function moveInQueue(direction) {
  if (!playbackOrder.length) return;
  let nextPosition = playbackQueueIndex + direction;
  if (nextPosition < 0 || nextPosition >= playbackOrder.length) {
    if (repeatMode !== "all") return;
    nextPosition = nextPosition < 0 ? playbackOrder.length - 1 : 0;
  }
  playQueueTrack(nextPosition);
}

async function playMediaItem(item) {
  const isSpotify = item.provider === "spotify";
  const useIframe = isSpotify;
  const requestId = ++playbackRequestId;
  clearTimeout(playerLoadTimer);
  playerHeading.textContent = item.title;
  playerArtist.textContent = item.uploader || (isSpotify ? "Spotify" : "YouTube Music");
  playerArtwork.hidden = useIframe || !item.thumbnail;
  if (!playerArtwork.hidden) playerArtwork.src = item.thumbnail;
  playerPlaceholder.hidden = useIframe || Boolean(item.thumbnail);
  playerOpenLink.hidden = false;
  playerPanel.classList.toggle("is-spotify", isSpotify);
  playerPanel.classList.toggle("is-audio", !useIframe);

  if (useIframe) {
    const playerUrl = new URL(`/embed/playlist/${encodeURIComponent(item.id)}`, "https://open.spotify.com/");
    audio.pause();
    audio.removeAttribute("src");
    audio.hidden = true;
    frame.src = playerUrl.href;
    frame.hidden = false;
    frame.title = `Player Spotify: ${item.title}`;
    playerOpenLink.href = `https://open.spotify.com/playlist/${encodeURIComponent(item.id)}`;
    playerOpenLink.textContent = "Apri Spotify ↗";
    playerNote.textContent = "Player ufficiale Spotify. La riproduzione può richiedere l’accesso a Spotify.";
    playerLoadStatus.hidden = true;
    setStatus(`Carico Spotify: ${item.title}`);
    return;
  }

  frame.hidden = true;
  frame.src = "about:blank";
  playerPlaceholder.hidden = Boolean(item.thumbnail);
  audio.hidden = false;
  audio.pause();
  audio.removeAttribute("src");
  playerOpenLink.href = `https://music.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
  playerOpenLink.textContent = "Apri YouTube Music ↗";
  playerNote.textContent = "Audio via Cobalt. Nessuna pubblicità.";
  playerLoadStatus.textContent = "Carico lo stream audio tramite Cobalt…";
  playerLoadStatus.hidden = false;
  setStatus(`Carico audio: ${item.title}`);

  try {
    const streamUrl = await fetchCobaltStream(item.videoId);
    if (requestId !== playbackRequestId) return;

    audio.src = streamUrl;
    audio.load();
    playerLoadStatus.hidden = true;
    try {
      await audio.play();
      if (requestId === playbackRequestId) setStatus(`In riproduzione: ${item.title}`);
    } catch {
      if (requestId === playbackRequestId) setStatus(`Stream pronto: premi play per ascoltare ${item.title}.`);
    }
  } catch (error) {
    if (requestId !== playbackRequestId) return;
    playerLoadStatus.textContent = "Impossibile estrarre lo stream. Prova il link YouTube Music ↗.";
    playerLoadStatus.hidden = false;
    setStatus("Errore durante il caricamento dello stream audio.", true);
  }
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "music-card";

  const coverButton = document.createElement("button");
  coverButton.className = "music-card-cover";
  coverButton.type = "button";
  coverButton.setAttribute("aria-label", `Riproduci ${item.title}`);
  if (item.thumbnail) {
    const image = document.createElement("img");
    image.src = item.thumbnail;
    image.alt = "";
    image.loading = "lazy";
    coverButton.append(image);
  }
  const playMark = document.createElement("span");
  playMark.setAttribute("aria-hidden", "true");
  playMark.textContent = "▶";
  coverButton.append(playMark);
  coverButton.addEventListener("click", () => playItem(item));

  const body = document.createElement("div");
  body.className = "music-card-body";
  const title = document.createElement("div");
  title.className = "music-card-title";
  title.textContent = item.title;
  const meta = document.createElement("p");
  meta.className = "music-card-meta";
  meta.textContent = item.type === "converted-playlist"
    ? `Playlist convertita · ${item.tracks.length} brani`
    : item.type === "spotify-playlist"
      ? `Playlist · ${item.uploader}`
    : item.uploader;

  const actions = document.createElement("div");
  actions.className = "music-card-actions";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = item.type === "converted-playlist" ? "Avvia playlist" : "Riproduci";
  playButton.addEventListener("click", () => playItem(item));
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "music-save-button";
  saveButton.textContent = isSaved(item) ? "Salvato" : "+ Raccolta";
  saveButton.setAttribute("aria-pressed", String(isSaved(item)));
  saveButton.addEventListener("click", () => {
    toggleSaved(item);
    const saved = isSaved(item);
    saveButton.textContent = saved ? "Salvato" : "+ Raccolta";
    saveButton.setAttribute("aria-pressed", String(saved));
  });
  actions.append(playButton, saveButton);
  body.append(title, meta, actions);
  card.append(coverButton, body);
  return card;
}

function renderItems(items, emptyMessage = "Nessun risultato trovato.", target = results) {
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "music-empty";
    empty.textContent = emptyMessage;
    target.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.append(createCard(item));
  target.append(fragment);
}

function renderHomePlaylists() {
  const playlists = library.filter((item) => ["spotify-playlist", "converted-playlist"].includes(item.type));
  homePlaylistsSection.hidden = activeView !== "home" || playlists.length === 0;
  homePlaylistCount.textContent = `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlist"}`;
  if (playlists.length) renderItems(playlists, "", homePlaylists);
}

function toggleSaved(item) {
  const key = itemKey(item);
  const index = library.findIndex((saved) => itemKey(saved) === key);
  if (index >= 0) {
    library.splice(index, 1);
    setStatus(`Rimosso dalla raccolta: ${item.title}`);
  } else {
    library.unshift(item);
    setStatus(`Aggiunto alla raccolta: ${item.title}`);
  }
  saveLibrary();
  if (activeView === "library") renderLibrary();
  else if (activeView === "home") renderHomePlaylists();
}

async function loadTrending() {
  if (activeView === "home") renderHomePlaylists();
  else homePlaylistsSection.hidden = true;
  results.replaceChildren();
  setStatus("Carico i brani popolari…");
  try {
    const resultsData = await fetchSearx("hit italia music 2026");
    const items = resultsData.map(normalizeSearxItem).filter(Boolean);
    renderItems(items, "Al momento non ci sono tendenze disponibili.");
    setStatus(items.length ? `${items.length} brani trovati` : "Nessun risultato disponibile.");
  } catch {
    renderItems([], "Le tendenze non sono raggiungibili. Puoi cercare un brano o una playlist.");
    setStatus("Servizio musicale temporaneamente non disponibile.", true);
  }
}

function renderLibrary() {
  const savedItems = [...library];
  renderItems(savedItems, "La raccolta è vuota. Salva un brano o una playlist dai risultati.");
  setStatus(`${savedItems.length} elementi salvati su questo dispositivo`);
}

function setSpotifyStatus(message, isError = false) {
  spotifyStatus.textContent = message;
  if (isError) spotifyStatus.dataset.error = "true";
  else delete spotifyStatus.dataset.error;
}

async function addSpotifyPlaylist(value) {
  const playlistId = parseSpotifyPlaylist(value);
  if (!playlistId) {
    setSpotifyStatus("Inserisci un link condiviso a una playlist Spotify.", true);
    return;
  }

  const spotifyItem = {
    id: playlistId,
    playlistId,
    videoId: "",
    type: "spotify-playlist",
    provider: "spotify",
    title: "Playlist Spotify",
    uploader: "Spotify",
    thumbnail: "",
  };
  if (isSaved(spotifyItem)) {
    setSpotifyStatus("Questa playlist è già nella tua raccolta.");
    return;
  }

  const submitButton = spotifyForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setSpotifyStatus("Recupero la playlist…");
  try {
    const metadataUrl = new URL("https://open.spotify.com/oembed");
    metadataUrl.searchParams.set("url", `https://open.spotify.com/playlist/${playlistId}`);
    const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Spotify oEmbed HTTP ${response.status}`);
    const metadata = await response.json();
    spotifyItem.title = metadata.title || spotifyItem.title;
    spotifyItem.thumbnail = metadata.thumbnail_url || "";
    library.unshift(spotifyItem);
    saveLibrary();
    spotifyUrlInput.value = "";
    setSpotifyStatus(`Aggiunta: ${spotifyItem.title}`);
    renderLibrary();
  } catch {
    setSpotifyStatus("Playlist non disponibile. Verifica che il link sia condivisibile e riprova.", true);
  } finally {
    submitButton.disabled = false;
  }
}

function parseSpotifyTrackRows(value) {
  return value.split(/\r?\n/).map((line) => {
    const row = line.trim();
    if (!row) return null;

    const columns = row.split("\t").map((column) => column.trim()).filter(Boolean);
    let title = columns[0] || "";
    let artist = columns[1] || "";
    if (columns.length === 1) {
      const parts = row.split(/\s+[–—-]\s+/);
      title = parts[0].trim();
      artist = parts.slice(1).join(" - ").trim();
    }

    if (["titolo", "title", "brano", "track"].includes(title.toLocaleLowerCase())) return null;
    return title ? { title, artist } : null;
  }).filter(Boolean);
}

function parseSpotifyCsv(value) {
  const firstLine = value.split(/\r?\n/, 1)[0] || "";
  const delimiterCounts = [",", ";", "\t"].map((delimiter) => {
    let count = 0;
    let quoted = false;
    for (const character of firstLine) {
      if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) count += 1;
    }
    return { delimiter, count };
  });
  const delimiter = delimiterCounts.sort((left, right) => right.count - left.count)[0].delimiter;
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (insideQuotes && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === delimiter && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLocaleLowerCase().replace(/[_\s]+/g, " "));
  const titleIndex = headers.findIndex((header) => /^(track|song|title|titolo)( name)?$/.test(header));
  const artistIndex = headers.findIndex((header) => /^artists?( name)?(\(s\))?$/.test(header) || header === "artist name(s)");
  const hasHeader = titleIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;