const PIPED_APIS = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
];
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
const frame = document.querySelector("#musicFrame");
const playerPlaceholder = document.querySelector("#playerPlaceholder");
const playerHeading = document.querySelector("#playerHeading");
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
const spotifyConvertStatus = document.querySelector("#spotifyConvertStatus");
const queueControls = document.querySelector("#musicQueueControls");
const queuePosition = document.querySelector("#queuePosition");
const previousTrackButton = document.querySelector("#previousTrack");
const nextTrackButton = document.querySelector("#nextTrack");

let activeView = "home";
let searchFilter = "music_songs";
let currentQuery = "";
let suggestionTimer;
let suggestionRequest = 0;
let library = loadLibrary();
let playbackQueue = [];
let playbackQueueIndex = -1;

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

async function fetchPiped(path) {
  let lastError;
  for (const api of PIPED_APIS) {
    try {
      const response = await fetch(new URL(path, `${api}/`), {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Piped API HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Piped API non disponibile");
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

function normalizeItem(item) {
  if (!item || typeof item.url !== "string") return null;
  let mediaUrl;
  try {
    mediaUrl = new URL(item.url, "https://youtube.com");
  } catch {
    return null;
  }
  const media = parseYoutubeLink(mediaUrl.href);
  if (!media) return null;

  const isPlaylist = item.type === "playlist" || mediaUrl.pathname === "/playlist";
  const id = isPlaylist ? media.playlistId : media.videoId;
  if (!id) return null;

  let thumbnail = "";
  try {
    const candidate = new URL(item.thumbnail);
    if (candidate.protocol === "https:") thumbnail = candidate.href;
  } catch {
    thumbnail = "";
  }

  return {
    id,
    videoId: isPlaylist ? "" : media.videoId,
    playlistId: isPlaylist ? media.playlistId : "",
    type: isPlaylist ? "playlist" : "stream",
    provider: "piped",
    title: item.title || item.name || "Senza titolo",
    uploader: item.uploaderName || item.uploader || "YouTube",
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
  const hasQueue = playbackQueue.length > 1;
  queueControls.hidden = !hasQueue;
  if (!hasQueue) return;
  queuePosition.textContent = `${playbackQueueIndex + 1} / ${playbackQueue.length}`;
  previousTrackButton.disabled = playbackQueueIndex <= 0;
  nextTrackButton.disabled = playbackQueueIndex >= playbackQueue.length - 1;
}

function playItem(item) {
  if (item.type === "converted-playlist") {
    playbackQueue = Array.isArray(item.tracks) ? item.tracks : [];
    if (!playbackQueue.length) {
      setStatus("Questa playlist convertita non contiene brani riproducibili.", true);
      return;
    }
    playQueueTrack(0);
    return;
  }

  playbackQueue = [];
  playbackQueueIndex = -1;
  updateQueueControls();
  playMediaItem(item);
}

function playQueueTrack(index) {
  if (index < 0 || index >= playbackQueue.length) return;
  playbackQueueIndex = index;
  playMediaItem(playbackQueue[index]);
  updateQueueControls();
}

function playMediaItem(item) {
  const isSpotify = item.provider === "spotify";
  const playerUrl = isSpotify
    ? new URL(`/embed/playlist/${encodeURIComponent(item.id)}`, "https://open.spotify.com/")
    : new URL(item.playlistId ? "/playlist" : "/watch", "https://piped.video/");
  if (!isSpotify && item.videoId) playerUrl.searchParams.set("v", item.videoId);
  if (!isSpotify && item.playlistId) playerUrl.searchParams.set("list", item.playlistId);
  frame.src = playerUrl.href;
  frame.hidden = false;
  playerPlaceholder.hidden = true;
  playerHeading.textContent = item.title;
  frame.title = `Player ${isSpotify ? "Spotify" : "Piped"}: ${item.title}`;
  playerOpenLink.href = isSpotify
    ? `https://open.spotify.com/playlist/${encodeURIComponent(item.id)}`
    : playerUrl.href;
  playerOpenLink.textContent = isSpotify ? "Apri Spotify ↗" : "Apri ↗";
  playerOpenLink.hidden = false;
  playerPanel.classList.toggle("is-spotify", isSpotify);
  playerNote.textContent = isSpotify
    ? "Player ufficiale Spotify. La riproduzione può richiedere l’accesso a Spotify."
    : "Player fornito da Piped. La disponibilità dipende dall’istanza esterna.";
  setStatus(`In riproduzione: ${item.title}`);
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
    : item.type === "playlist" || item.type === "spotify-playlist"
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

function renderItems(items, emptyMessage = "Nessun risultato trovato.") {
  results.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "music-empty";
    empty.textContent = emptyMessage;
    results.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.append(createCard(item));
  results.append(fragment);
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
}

async function loadTrending() {
  results.replaceChildren();
  setStatus("Carico le tendenze…");
  try {
    const data = await fetchPiped("/trending?region=IT");
    const items = (Array.isArray(data) ? data : []).map(normalizeItem).filter(Boolean);
    renderItems(items, "Al momento non ci sono tendenze disponibili.");
    setStatus(items.length ? `${items.length} tendenze` : "Nessun risultato disponibile.");
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

function setConversionStatus(message, isError = false) {
  spotifyConvertStatus.textContent = message;
  if (isError) spotifyConvertStatus.dataset.error = "true";
  else delete spotifyConvertStatus.dataset.error;
}

async function convertSpotifyPlaylist(urlValue, trackListValue) {
  const playlistId = parseSpotifyPlaylist(urlValue);
  const tracks = parseSpotifyTrackRows(trackListValue);
  if (!playlistId) {
    setConversionStatus("Inserisci un link condiviso valido a una playlist Spotify.", true);
    return;
  }
  if (!tracks.length) {
    setConversionStatus("Incolla almeno un brano, uno per riga.", true);
    return;
  }
  if (tracks.length > 200) {
    setConversionStatus("Puoi convertire fino a 200 brani per playlist.", true);
    return;
  }

  const submitButton = spotifyConvertForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setConversionStatus(`Cerco 0/${tracks.length} brani…`);

  try {
    const metadataUrl = new URL("https://open.spotify.com/oembed");
    metadataUrl.searchParams.set("url", `https://open.spotify.com/playlist/${playlistId}`);
    let metadata = {};
    try {
      const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(12000) });
      if (response.ok) metadata = await response.json();
    } catch {
      metadata = {};
    }

    const matchesByIndex = new Array(tracks.length).fill(null);
    const batchSize = 20;
    const concurrency = 4;
    let completed = 0;
    for (let batchStart = 0; batchStart < tracks.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, tracks.length);
      let nextIndex = batchStart;
      await Promise.all(Array.from({ length: Math.min(concurrency, batchEnd - batchStart) }, async () => {
        while (nextIndex < batchEnd) {
          const index = nextIndex;
          nextIndex += 1;
          const track = tracks[index];
          const query = [track.title, track.artist].filter(Boolean).join(" ");
          const params = new URLSearchParams({ q: query, filter: "music_songs" });
          try {
            const data = await fetchPiped(`/search?${params}`);
            const match = (data.items || []).map(normalizeItem).find((item) => item?.type === "stream");
            if (match) matchesByIndex[index] = { ...match, sourceTitle: track.title, sourceArtist: track.artist };
          } catch {
            matchesByIndex[index] = null;
          }
          completed += 1;
          setConversionStatus(`Convertiti ${completed}/${tracks.length} brani…`);
        }
      }));
    }
    const matches = matchesByIndex.filter(Boolean);
    const missing = tracks.filter((_, index) => !matchesByIndex[index]).map((track) => track.title);

    if (!matches.length) {
      setConversionStatus("Non ho trovato corrispondenze. Riprova con titoli e artisti più precisi.", true);
      return;
    }

    const convertedPlaylist = {
      id: `spotify-${playlistId}`,
      type: "converted-playlist",
      provider: "piped",
      title: metadata.title ? `${metadata.title} · YouTube` : "Playlist convertita · YouTube",
      uploader: "Spotify → Piped",
      thumbnail: metadata.thumbnail_url || "",
      spotifyPlaylistId: playlistId,
      tracks: matches,
    };
    library = library.filter((item) => itemKey(item) !== itemKey(convertedPlaylist));
    library.unshift(convertedPlaylist);
    saveLibrary();
    spotifyUrlInput.value = urlValue.trim();
    setConversionStatus(`Convertiti ${matches.length}/${tracks.length} brani.${missing.length ? ` Non trovati: ${missing.join(", ")}.` : ""}`);
    renderLibrary();
  } catch {
    setConversionStatus("La conversione non è riuscita. Controlla la connessione e riprova.", true);
  } finally {
    submitButton.disabled = false;
  }
}

async function performSearch(query, filter = searchFilter) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    updateNavigation("search");
    viewEyebrow.textContent = "Esplora il catalogo";
    viewTitle.textContent = "Cerca musica";
    showFilters(true);
    renderItems([], "Cerca un brano, un artista o una playlist.");
    setStatus("");
    return;
  }

  const media = parseYoutubeLink(trimmedQuery);
  if (media) {
    const item = {
      id: media.playlistId || media.videoId,
      videoId: media.videoId,
      playlistId: media.playlistId,
      type: media.playlistId && !media.videoId ? "playlist" : "stream",
      title: "Link YouTube",
      uploader: "",
      thumbnail: "",
    };
    playItem(item);
    return;
  }

  currentQuery = trimmedQuery;
  searchFilter = filter;
  updateNavigation("search");
  showFilters(true);
  viewEyebrow.textContent = filter === "music_playlists" ? "Playlist" : "Brani";
  viewTitle.textContent = `Risultati per ${trimmedQuery}`;
  results.replaceChildren();
  setStatus("Cerco…");
  hideSuggestions();

  const params = new URLSearchParams({ q: trimmedQuery, filter });
  try {
    const data = await fetchPiped(`/search?${params}`);
    const items = (data.items || []).map(normalizeItem).filter(Boolean);
    const filteredItems = filter === "music_playlists"
      ? items.filter((item) => item.type === "playlist")
      : items.filter((item) => item.type === "stream");
    renderItems(filteredItems, "Nessun risultato trovato. Prova un’altra ricerca.");
    setStatus(`${filteredItems.length} risultati`);
  } catch {
    renderItems([], "La ricerca non è disponibile al momento.");
    setStatus("Impossibile raggiungere il servizio musicale.", true);
  }
}

async function showView(view) {
  updateNavigation(view);
  spotifyImport.hidden = view !== "library";
  if (view === "search") {
    viewEyebrow.textContent = "Esplora il catalogo";
    viewTitle.textContent = currentQuery ? `Risultati per ${currentQuery}` : "Cerca musica";
    showFilters(true);
    if (currentQuery) await performSearch(currentQuery, searchFilter);
    else {
      renderItems([], "Cerca un brano, un artista o una playlist.");
      setStatus("");
    }
    return;
  }

  showFilters(false);
  if (view === "library") {
    viewEyebrow.textContent = "Salvata su questo dispositivo";
    viewTitle.textContent = "La tua raccolta";
    renderLibrary();
    return;
  }

  if (view === "trending") {
    viewEyebrow.textContent = "Italia";
    viewTitle.textContent = "Tendenze";
  } else {
    viewEyebrow.textContent = "La selezione di oggi";
    viewTitle.textContent = "Per te";
  }
  await loadTrending();
}

function hideSuggestions() {
  suggestions.hidden = true;
  queryInput.setAttribute("aria-expanded", "false");
}

function showSuggestions(values) {
  suggestions.replaceChildren();
  for (const value of values.slice(0, 7)) {
    if (typeof value !== "string") continue;
    const option = document.createElement("button");
    option.type = "button";
    option.setAttribute("role", "option");
    option.textContent = value;
    option.addEventListener("click", () => {
      queryInput.value = value;
      hideSuggestions();
      performSearch(value);
    });
    suggestions.append(option);
  }
  suggestions.hidden = suggestions.childElementCount === 0;
  queryInput.setAttribute("aria-expanded", String(!suggestions.hidden));
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(queryInput.value);
});

spotifyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addSpotifyPlaylist(spotifyUrlInput.value);
});

spotifyConvertForm.addEventListener("submit", (event) => {
  event.preventDefault();
  convertSpotifyPlaylist(spotifyConvertUrl.value, spotifyTrackList.value);
});

previousTrackButton.addEventListener("click", () => playQueueTrack(playbackQueueIndex - 1));
nextTrackButton.addEventListener("click", () => playQueueTrack(playbackQueueIndex + 1));

queryInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  const query = queryInput.value.trim();
  const requestId = ++suggestionRequest;
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  suggestionTimer = setTimeout(async () => {
    try {
      const values = await fetchPiped(`/suggestions?query=${encodeURIComponent(query)}`);
      if (requestId === suggestionRequest && queryInput.value.trim() === query) {
        showSuggestions(Array.isArray(values) ? values : []);
      }
    } catch {
      if (requestId === suggestionRequest) hideSuggestions();
    }
  }, 240);
});

queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideSuggestions();
});

document.addEventListener("click", (event) => {
  if (!searchForm.contains(event.target)) hideSuggestions();
});

for (const button of navButtons) {
  button.addEventListener("click", () => showView(button.dataset.view));
}

for (const button of filters.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => {
    searchFilter = button.dataset.filter;
    showFilters(true);
    if (currentQuery) performSearch(currentQuery, searchFilter);
  });
}

document.querySelector("#quickSearches").addEventListener("click", (event) => {
  const button = event.target.closest("[data-query]");
  if (!button) return;
  queryInput.value = button.dataset.query;
  performSearch(button.dataset.query, "music_songs");
});

window.addEventListener("storage", (event) => {
  if (event.key !== LIBRARY_KEY) return;
  library = loadLibrary();
  if (activeView === "library") renderLibrary();
});

showView("home");