document.addEventListener('DOMContentLoaded', () => {
  /* ============================================================
     CONFIGURAZIONE PROVIDER & PROXY
     ============================================================ */
  const CONSUMET_BASE = 'https://api.consumet.org';
  const CONSUMET_PROVIDER = 'gogoanime';

  const STREAM_TIMEOUT_MS = 20000;
  const EPISODES_PER_PAGE = 50;

  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchGrid = document.getElementById('searchGrid');
  const watchlistGrid = document.getElementById('watchlistGrid');

  const currentUsernameSpan = document.getElementById('currentUsername');
  const changeUserBtn = document.getElementById('changeUserBtn');
  const favCountSpan = document.getElementById('favCount');

  const animePlayerPanel = document.getElementById('animePlayerPanel');
  const animePlayerTitle = document.getElementById('animePlayerTitle');
  const animePlayerStatus = document.getElementById('animePlayerStatus');
  const animeEpisodeList = document.getElementById('animeEpisodeList');
  const authorizedVideoPlayer = document.getElementById('authorizedVideoPlayer');
  const closeAnimePlayer = document.getElementById('closeAnimePlayer');
  let authorizedStreamRequest = 0;

  /* ---------- Pannello fonti ---------- */
  const sourcePanel = document.createElement('div');
  sourcePanel.id = 'animeSourcePanel';
  sourcePanel.hidden = true;
  sourcePanel.style.cssText = 'margin: 12px 0 4px;';

  const sourceHeader = document.createElement('div');
  sourceHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px;';

  const sourceTitle = document.createElement('strong');
  sourceTitle.style.cssText = 'font-size: 0.9rem;';
  sourceTitle.textContent = 'Fonti disponibili';

  const reloadSourcesBtn = document.createElement('button');
  reloadSourcesBtn.type = 'button';
  reloadSourcesBtn.textContent = '↻ Aggiorna fonti';
  reloadSourcesBtn.style.cssText = 'padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid currentColor; background: transparent; color: inherit;';
  reloadSourcesBtn.addEventListener('click', () => {
    if (currentAnime) playAuthorizedEpisode(currentAnime, currentEpisode);
  });

  sourceHeader.append(sourceTitle, reloadSourcesBtn);

  const sourceList = document.createElement('div');
  sourceList.id = 'animeSourceList';
  sourceList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';

  sourcePanel.append(sourceHeader, sourceList);

  if (animePlayerPanel && authorizedVideoPlayer) {
    const videoHost = authorizedVideoPlayer.closest('.player-container') || authorizedVideoPlayer.parentElement;
    if (videoHost && videoHost.after) videoHost.after(sourcePanel);
    else animePlayerPanel.append(sourcePanel);
  }

  let currentAnime = null;
  let currentEpisode = 1;
  let currentSources = [];
  let currentSourceIndex = -1;

  function setAnimePlayerStatus(message, isError = false) {
    if (!animePlayerStatus) return;
    animePlayerStatus.textContent = message;
    animePlayerStatus.dataset.error = String(isError);
  }

  function setSourceStatus(message, isError = false) {
    if (!sourceTitle) return;
    sourceTitle.textContent = message;
    sourceTitle.style.color = isError ? '#cc3300' : 'inherit';
  }

  /* ============================================================
     HLS Support (hls.js)
     ============================================================ */
  let hlsLibPromise = null;
  let hlsInstance = null;

  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsLibPromise) {
      hlsLibPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
        script.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('hls.js non disponibile')));
        script.onerror = () => reject(new Error('hls.js non caricato'));
        document.head.append(script);
      });
    }
    return hlsLibPromise;
  }

  function destroyHls() {
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch {}
      hlsInstance = null;
    }
  }

  function resetVideoPlayer() {
    if (!authorizedVideoPlayer) return;
    destroyHls();
    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');
    authorizedVideoPlayer.load();
  }

  /* ============================================================
     FETCH STREAMING TRAMITE PROXY CORS
     ============================================================ */

  async function consumetFetch(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const targetUrl = `${CONSUMET_BASE}/anime/${CONSUMET_PROVIDER}${cleanPath}`;
    
    // Inoltro tramite proxy CORS per aggirare il blocco browser/GitHub Pages
    const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const res = await fetch(proxiedUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`Consumet ha risposto ${res.status}`);
      return await res.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Timeout della richiesta');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchStreams(anime, episodeNumber) {
    let animeId = anime.consumet_id;
    
    // Se non abbiamo l'ID di Consumet, lo cerchiamo con il titolo dell'anime
    if (!animeId) {
      const searchRes = await consumetFetch(`/${encodeURIComponent(anime.title)}`);
      const results = searchRes.results || [];
      if (results.length === 0) throw new Error('Anime non trovato sul provider video');
      animeId = results[0].id;
      anime.consumet_id = animeId;
    }

    // 1. Recupero informazioni episodi
    const info = await consumetFetch(`/info/${animeId}`);
    const episodes = info.episodes || [];
    
    const targetEp = episodes.find(ep => ep.number === episodeNumber) || episodes[episodeNumber - 1];
    if (!targetEp) throw new Error(`Episodio ${episodeNumber} non disponibile`);

    // 2. Recupero sorgenti video
    const watchData = await consumetFetch(`/watch/${targetEp.id}`);
    const sources = watchData.sources || [];

    sources.sort((a, b) => {
      if (a.quality === '1080p') return -1;
      if (b.quality === '1080p') return 1;
      return 0;
    });

    return {
      playable: sources.map(s => ({ 
        url: s.url, 
        name: s.quality || 'HD', 
        description: `Server ${s.isM3U8 ? 'HLS' : 'MP4'}` 
      })),
      total: episodes.length
    };
  }

  function renderSources() {
    if (!sourceList) return;
    sourceList.replaceChildren();
    currentSources.forEach((stream, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${stream.name} (${index + 1})`;
      button.title = stream.description;
      button.setAttribute('aria-pressed', String(index === currentSourceIndex));
      button.style.cssText = 'padding: 6px 10px; font-size: 0.8rem; border-radius: 4px; cursor: pointer; ' +
                             'border: 1px solid currentColor; background: transparent; color: inherit; ' +
                             'max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      if (index === currentSourceIndex) {
        button.style.background = '#0066cc';
        button.style.color = '#fff';
        button.style.borderColor = '#0066cc';
      }
      button.addEventListener('click', () => playSource(index));
      sourceList.append(button);
    });
  }

  async function playSource(index) {
    const stream = currentSources[index];
    if (!stream || !authorizedVideoPlayer) return;

    currentSourceIndex = index;
    renderSources();
    resetVideoPlayer();

    const href = String(stream.url);
    const label = stream.name;

    if (/\.m3u8($|\?)/i.test(href) &&
        authorizedVideoPlayer.canPlayType('application/vnd.apple.mpegurl') === '') {
      try {
        const Hls = await loadHlsLibrary();
        if (Hls && Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
            if (data && data.fatal) advanceToNextSource();
          });
          hlsInstance.loadSource(href);
          hlsInstance.attachMedia(authorizedVideoPlayer);
          setAnimePlayerStatus(`Episodio ${currentEpisode} (${label}, HLS).`);
          authorizedVideoPlayer.play().catch(() => {});
          return;
        }
      } catch {
        setAnimePlayerStatus('hls.js non caricato: la fonte HLS potrebbe non partire.', true);
      }
    }

    authorizedVideoPlayer.src = href;
    authorizedVideoPlayer.play()
      .then(() => setAnimePlayerStatus(`Riproduzione episodio ${currentEpisode} (${label}).`))
      .catch(() => setAnimePlayerStatus(`Episodio ${currentEpisode}: premi play per avviare (${label}).`));
  }

  function advanceToNextSource() {
    if (!currentAnime || currentSourceIndex < 0 || !currentSources.length) return;
    if (currentSourceIndex + 1 < currentSources.length) {
      setAnimePlayerStatus('Fonte non riproducibile, passo alla successiva…');
      playSource(currentSourceIndex + 1);
    } else {
      setAnimePlayerStatus(`Nessuna fonte riproducibile per l'episodio ${currentEpisode}.`, true);
    }
  }

  if (authorizedVideoPlayer) {
    authorizedVideoPlayer.addEventListener('error', advanceToNextSource);
  }

  async function playAuthorizedEpisode(anime, episode) {
    if (!authorizedVideoPlayer) return;

    const requestId = ++authorizedStreamRequest;
    currentAnime = anime;
    currentEpisode = episode;
    currentSources = [];
    currentSourceIndex = -1;

    if (sourcePanel) sourcePanel.hidden = false;
    if (sourceList) sourceList.replaceChildren();

    resetVideoPlayer();

    setAnimePlayerStatus(`Cerco le fonti video per l'episodio ${episode}…`);
    setSourceStatus('Ricerca fonti...');

    try {
      const { playable } = await fetchStreams(anime, episode);
      if (requestId !== authorizedStreamRequest) return;

      if (!playable.length) {
        setSourceStatus('Nessun link video trovato.', true);
        setAnimePlayerStatus('Nessun risultato disponibile per questo episodio.', true);
        return;
      }

      currentSources = playable;
      setSourceStatus(`${playable.length} fonti disponibili`);
      playSource(0);
    } catch (error) {
      if (requestId !== authorizedStreamRequest) return;
      setSourceStatus(`Errore: ${error.message}`, true);
      setAnimePlayerStatus('Impossibile caricare lo streaming per questo episodio.', true);
    }
  }

  /* ---------------- Pagina ed Episodi ---------------- */
  const episodeState = { anime: null, shown: 0, total: null };

  function renderEpisodeButtons() {
    const { total } = episodeState;
    if (!episodeState.anime || !animeEpisodeList) return;

    animeEpisodeList.replaceChildren();

    for (let episode = 1; episode <= episodeState.shown; episode++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Ep ${episode}`;
      button.setAttribute('aria-pressed', String(episode === currentEpisode));
      button.addEventListener('click', () => {
        currentEpisode = episode;
        animeEpisodeList.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        playAuthorizedEpisode(episodeState.anime, episode);
      });
      animeEpisodeList.append(button);
    }

    const remaining = total === null ? EPISODES_PER_PAGE : total - episodeState.shown;
    if (remaining > 0) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'episode-more-btn';
      more.textContent = `+ altri ${Math.min(EPISODES_PER_PAGE, remaining)}`;
      more.addEventListener('click', () => {
        episodeState.shown += EPISODES_PER_PAGE;
        renderEpisodeButtons();
      });
      animeEpisodeList.append(more);
    }
  }

  function openAuthorizedPlayer(anime) {
    if (!animePlayerPanel || !animeEpisodeList || !authorizedVideoPlayer) return;

    animePlayerPanel.hidden = false;
    animePlayerTitle.textContent = anime.title || 'Anime';

    resetVideoPlayer();
    if (sourcePanel) sourcePanel.hidden = true;
    if (sourceList) sourceList.replaceChildren();

    const episodeCount = Number(anime.episodes) || 12;

    currentAnime = anime;
    currentEpisode = 1;
    episodeState.anime = anime;
    episodeState.total = episodeCount;
    episodeState.shown = Math.min(episodeCount, EPISODES_PER_PAGE);
    renderEpisodeButtons();

    setAnimePlayerStatus('Seleziona un episodio per avviare la riproduzione.');
    animePlayerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (closeAnimePlayer) {
    closeAnimePlayer.addEventListener('click', () => {
      authorizedStreamRequest++;
      resetVideoPlayer();
      animePlayerPanel.hidden = true;
    });
  }

  /* ---------------- Profilo & Preferiti ---------------- */
  let currentUser = localStorage.getItem('epstein_anime_user') || 'Utente';
  if (currentUsernameSpan) currentUsernameSpan.textContent = currentUser;

  if (changeUserBtn) {
    changeUserBtn.addEventListener('click', () => {
      const newName = prompt('Inserisci il tuo nome utente:', currentUser);
      if (newName !== null && newName.trim() !== '') {
        currentUser = newName.trim();
        localStorage.setItem('epstein_anime_user', currentUser);
        if (currentUsernameSpan) currentUsernameSpan.textContent = currentUser;
        updateFavCounter();
        const watchlistTab = document.getElementById('tab-watchlist');
        if (watchlistTab && !watchlistTab.hidden) loadWatchlist();
      }
    });
  }

  function getFavoritesKey() {
    return `epstein_favorites_${currentUser}`;
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(getFavoritesKey())) || [];
    } catch {
      return [];
    }
  }

  function updateFavCounter() {
    if (favCountSpan) favCountSpan.textContent = getFavorites().length;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.hidden = true);

      tab.classList.add('active');
      const targetTab = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetTab) {
        targetTab.hidden = false;
        if (tab.dataset.tab === 'watchlist') loadWatchlist();
      }
    });
  });

  function createAnimeCard(anime) {
    const favs = getFavorites();
    const isFav = favs.some(f => String(f.mal_id) === String(anime.mal_id));

    const card = document.createElement('article');
    card.className = 'anime-card';
    card.dataset.id = anime.mal_id;

    const image = document.createElement('img');
    image.className = 'anime-poster';
    image.src = anime.images?.jpg?.image_url || anime.image || '';
    image.alt = anime.title || 'Copertina anime';
    image.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'anime-info';
    const title = document.createElement('h3');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Titolo non disponibile';
    const metadata = document.createElement('p');
    metadata.style.cssText = 'font-size: 0.8rem; opacity: 0.7; margin: 0;';
    metadata.textContent = `📺 ${anime.episodes ?? '?'} ep`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const playerButton = document.createElement('button');
    playerButton.className = 'watch-btn';
    playerButton.type = 'button';
    playerButton.textContent = 'Apri player';
    playerButton.addEventListener('click', () => openAuthorizedPlayer(anime));

    const favBtn = document.createElement('button');
    favBtn.className = `fav-btn${isFav ? ' active-fav' : ''}`;
    favBtn.type = 'button';
    favBtn.textContent = isFav ? '⭐ Salvato' : '☆ Preferito';

    actions.append(playerButton, favBtn);
    info.append(title, metadata, actions);
    card.append(image, info);

    favBtn.addEventListener('click', () => {
      let currentFavs = getFavorites();
      const index = currentFavs.findIndex(f => String(f.mal_id) === String(anime.mal_id));

      if (index > -1) {
        currentFavs.splice(index, 1);
      } else {
        currentFavs.push(anime);
      }

      localStorage.setItem(getFavoritesKey(), JSON.stringify(currentFavs));
      const isNowFavorite = index === -1;
      favBtn.classList.toggle('active-fav', isNowFavorite);
      favBtn.textContent = isNowFavorite ? '⭐ Salvato' : '☆ Preferito';
      updateFavCounter();
      const watchlistTab = document.getElementById('tab-watchlist');
      if (watchlistTab && !watchlistTab.hidden) loadWatchlist();
    });

    return card;
  }

  /* ---------------- Ricerca Stabile tramite Kitsu API ---------------- */
  async function searchAnime(query) {
    const term = query.trim();
    if (!searchGrid) return;
    if (!term) {
      searchGrid.textContent = 'Scrivi un titolo per avviare la ricerca.';
      return;
    }

    const loading = document.createElement('p');
    loading.textContent = 'Ricerca in corso…';
    searchGrid.replaceChildren(loading);
    if (searchBtn) searchBtn.disabled = true;

    try {
      // Uso di Kitsu API (senza problemi di CORS o 500)
      const res = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(term)}&page[limit]=20`, {
        headers: { Accept: 'application/vnd.api+json' }
      });

      if (!res.ok) throw new Error(`Kitsu ha risposto ${res.status}`);
      const data = await res.json();
      searchGrid.replaceChildren();

      const results = data.data || [];

      if (results.length > 0) {
        results.forEach(item => {
          const attr = item.attributes || {};
          const titles = attr.titles || {};

          const anime = {
            mal_id: `kitsu-${item.id}`,
            consumet_id: null, // Si cercherà solo al Play
            title: attr.canonicalTitle || titles.en || titles.en_jp || titles.ja_jp || 'Titolo non disponibile',
            images: { 
              jpg: { 
                image_url: attr.posterImage?.small || attr.posterImage?.medium || '' 
              } 
            },
            episodes: attr.episodeCount || '?'
          };

          searchGrid.appendChild(createAnimeCard(anime));
        });
      } else {
        searchGrid.textContent = `Nessun anime trovato per "${term}".`;
      }
    } catch (err) {
      console.error('Errore ricerca:', err);
      searchGrid.textContent = `Ricerca non riuscita (${err.message}). Riprova tra poco.`;
    } finally {
      if (searchBtn) searchBtn.disabled = false;
    }
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => searchAnime(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchAnime(searchInput.value);
    });
  }

  function loadWatchlist() {
    const favs = getFavorites();
    if (watchlistGrid) {
      watchlistGrid.innerHTML = '';
      updateFavCounter();

      if (favs.length === 0) {
        watchlistGrid.innerHTML = '<p>Non hai ancora aggiunto preferiti.</p>';
        return;
      }
      favs.forEach(anime => watchlistGrid.appendChild(createAnimeCard(anime)));
    }
  }

  updateFavCounter();
  searchAnime('Naruto');
});