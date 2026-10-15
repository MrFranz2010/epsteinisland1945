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
  playerLoadStatus.textContent = "Lo stream audio non è disponibile. Prova il link Cerca su YouTube ↗.";
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
  if (!status) return;
  status.textContent = message;
  if (isError) status.dataset.error = "true";
  else delete status.dataset.error;
}

async function fetchItunes(term, limit = 20) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("iTunes API HTTP Error");
  const data = await response.json();
  return data.results || [];
}

async function fetchCobaltStream(searchQuery) {
  const response = await fetch(COBALT_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
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

function normalizeItunesItem(item) {
  if (!item || !item.trackId) return null;
  const title = item.trackName || "Senza titolo";
  const artist = item.artistName || "Artista sconosciuto";
  const thumbnail = item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "300x300bb") : "";

  return {
    id: `itunes-${item.trackId}`,
    videoId: "",
    playlistId: "",
    query: `${artist} - ${title}`,
    type: "stream",
    provider: "itunes",
    title: title,
    uploader: artist,
    thumbnail: thumbnail,
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
  if (!filters) return;
  filters.hidden = !visible;
  for (const button of filters.querySelectorAll("[data-filter]")) {
    const selected = button.dataset.filter === searchFilter;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function updateQueueControls() {
  if (!queueControls) return;
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
  playerArtist.textContent = item.uploader || (isSpotify ? "Spotify" : "Musica");
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
  playerOpenLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.query || `${item.title}${item.uploader}`)}`;
  playerOpenLink.textContent = "Cerca su YouTube ↗";
  playerNote.textContent = "Audio via Cobalt. Senza pubblicità.";
  playerLoadStatus.textContent = "Carico lo stream audio…";
  playerLoadStatus.hidden = false;
  setStatus(`Carico audio: ${item.title}`);

  try {
    const searchQuery = item.query || `${item.title} ${item.uploader}`;
    const streamUrl = await fetchCobaltStream(searchQuery);
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
    playerLoadStatus.textContent = "Impossibile estrarre lo stream audio al momento.";
    playerLoadStatus.hidden = false;
    setStatus("Errore durante il caricamento dello stream audio.", true);
  }
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "music-card";

  const coverButton = document.createElement("button");
  coverButton.className = "music-card-cover";