document.addEventListener('DOMContentLoaded', () => {
  /* ============================================================
     CONFIGURAZIONE COMET (scraping fonti)

     COMET_BASE  -> istanza Comet. NOTA: comet.elfhosted.com è dietro
                    Cloudflare e risponde 403 senza header CORS, quindi
                    la fetch dal browser fallisce. comet.feels.legal
                    (istanza pubblica ufficiale) funziona.

     COMET_CONFIG-> b64config copiato dall'URL del manifest su /configure.
                    SENZA debrid configurato Comet restituisce solo infoHash,
                    che un <video> non sa riprodurre: serve un debrid
                    (TorBox, Real-Debrid, AllDebrid...) per avere il campo url.

     COMET_PROXY -> endpoint tuo che inoltra: fetch(decodeURIComponent(req.query.url))
                    e aggiunge gli header CORS. Esempio:
                    'https://mio-worker.workers.dev/?url='
                    Usato come fallback se la fetch diretta viene bloccata.
     ============================================================ */
  const COMET_BASE = 'https://comet.feels.legal';
  const COMET_CONFIG = '';
  const COMET_PROXY = '';

  const KITSU_API = 'https://kitsu.io/api/edge';
  const KITSU_CACHE_PREFIX = 'epstein_kitsu_';
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

  /* ---------- Pannello fonti, stessa struttura del player ---------- */
  const sourcePanel = document.createElement('div');
  sourcePanel.id = 'animeSourcePanel';
  sourcePanel.hidden = true;
  sourcePanel.style.cssText = 'margin: 12px 0 4px;';

  const sourceHeader = document.createElement('div');
  sourceHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px;';

  const sourceTitle = document.createElement('strong');
  sourceTitle.style.cssText = 'font-size: 0.9rem;';
  sourceTitle.textContent = 'Fonti da Comet';

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
     HLS opzionale: caricato solo se una fonte è .m3u8 e il browser
     non la supporta nativamente (Chrome/Firefox).
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
      try { hlsInstance.destroy(); } catch { /* già distrutto */ }
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
     COMET: id Kitsu e scraping degli stream
     ============================================================ */

  function cometFullUrl(path) {
    const base = COMET_BASE.replace(/\/$/, '');
    const config = COMET_CONFIG ? `/${COMET_CONFIG.replace(/^\/|\/$/g, '')}` : '';
    return `${base}${config}${path}`;
  }

  /* Fetch con timeout e fallback automatico sul proxy CORS */
  async function cometFetch(path) {
    const full = cometFullUrl(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const res = await fetch(full, { signal: controller.signal });
      if (!res.ok) throw new Error(`Comet ha risposto ${res.status}`);
      return await res.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (!COMET_PROXY) throw error;

      setSourceStatus('Fetch diretta bloccata, provo dal proxy…');
      const proxied = await fetch(`${COMET_PROXY}${encodeURIComponent(full)}`);
      if (!proxied.ok) throw new Error(`proxy ha risposto ${proxied.status}`);
      return await proxied.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function readKitsuCache(malId) {
    try {
      const raw = localStorage.getItem(KITSU_CACHE_PREFIX + malId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeKitsuCache(malId, kitsuId) {
    try {
      localStorage.setItem(KITSU_CACHE_PREFIX + malId, JSON.stringify({ id: kitsuId, at: Date.now() }));
    } catch { /* quota piena */ }
  }

  /* MAL id -> Kitsu id, solo per i preferiti salvati con la vecchia ricerca */
  async function kitsuIdFromMal(malId) {
    if (!malId) return null;
    const cached = readKitsuCache(malId);
    if (cached && cached.id) return cached.id;
    try {
      const url = `${KITSU_API}/mappings?filter[externalSite]=myanimelist/anime` +
                  `&filter[externalId]=${encodeURIComponent(malId)}&include=item`;
      const res = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const item = (json.data || [])
        .map(m => m && m.relationships && m.relationships.item && m.relationships.item.data)
        .find(i => i && i.type === 'anime');
      if (item && item.id) {
        writeKitsuCache(malId, item.id);
        return item.id;
      }
    } catch { /* si prova col titolo */ }
    return null;
  }

  async function kitsuIdFromTitle(title) {
    if (!title) return null;
    try {
      const res = await fetch(`${KITSU_API}/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`,
        { headers: { Accept: 'application/vnd.api+json' } });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const first = (json.data || [])[0];
      return first && first.id ? first.id : null;
    } catch {
      return null;
    }
  }

  async function kitsuIdFor(anime) {
    const raw = String(anime.mal_id || '');
    const direct = raw.match(/^kitsu-(\d+)$/);
    if (direct) return direct[1];
    if (/^\d+$/.test(raw)) {
      const mapped = await kitsuIdFromMal(raw);
      if (mapped) return mapped;
    }
    return kitsuIdFromTitle(anime.title);
  }

  /* Comet mette qualità, seeders e tracker nella description:
     va letta anche quella, non solo name/title/filename. */
  function streamText(stream) {
    const hint = stream.behaviorHints && stream.behaviorHints.filename ? stream.behaviorHints.filename : '';
    return `${stream.name || ''} ${stream.title || ''} ${stream.description || ''} ${hint}`.toLowerCase();
  }

  /* Prima i link riproducibili diretti, poi qualità e seeders */
  function streamScore(stream) {
    const text = streamText(stream);
    let score = 0;
    if (/2160p|4k/.test(text)) score += 40;
    else if (/1080p/.test(text)) score += 30;
    else if (/720p/.test(text)) score += 20;
    else if (/480p/.test(text)) score += 10;
    if (/proxystream|proxy/.test(text)) score += 5;
    const seeders = text.match(/👤\s*(\d+)/);
    if (seeders) score += Math.min(Number(seeders[1]), 9);
    return score;
  }

  function streamLabel(stream) {
    const text = `${stream.name || 'Fonte'} ${stream.description || ''}`;
    const quality = text.match(/(2160p|4k|1440p|1080p|720p|480p|360p)/i);
    const name = (stream.name || 'Fonte').replace(/\[.*?\]\s*/g, '').trim() || 'Fonte';
    return quality ? `${name} ${quality[1].toLowerCase()}` : name;
  }

  async function fetchStreams(anime, episode) {
    const kitsuId = await kitsuIdFor(anime);
    if (!kitsuId) throw new Error('nessun id Kitsu trovato per questo titolo');

    const data = await cometFetch(`/stream/series/kitsu:${kitsuId}:${episode}.json`);
    const all = (data.streams || []).filter(s => s && (s.url || s.infoHash));
    const playable = all.filter(s => typeof s.url === 'string' && s.url);
    playable.sort((a, b) => streamScore(b) - streamScore(a));

    return { playable, torrents: all.length - playable.length, total: all.length };
  }

  function renderSources() {
    if (!sourceList) return;
    sourceList.replaceChildren();
    currentSources.forEach((stream, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${streamLabel(stream)} ${index + 1}`;
      button.title = `${stream.name || ''} — ${stream.description || ''}`.trim();
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
    const label = streamLabel(stream);

    /* HLS: prova il supporto nativo, altrimenti hls.js */
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

  /* Se una fonte muore a metà, passo alla successiva */
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

    setAnimePlayerStatus(`Cerco le fonti su Comet per l'episodio ${episode}…`);
    setSourceStatus('Fonti da Comet');

    try {
      const { playable, torrents, total } = await fetchStreams(anime, episode);
      if (requestId !== authorizedStreamRequest) return;

      if (!playable.length) {
        if (!total) {
          setSourceStatus('Comet non ha trovato nulla per questo episodio.', true);
          setAnimePlayerStatus('Nessun risultato: prova un altro episodio o un altro titolo.', true);
        } else {
          setSourceStatus(`Nessun link diretto: ${torrents} torrent senza url.`, true);
          setAnimePlayerStatus(
            'Comet ha trovato solo torrent (infoHash): configura un debrid e metti il b64config in COMET_CONFIG.',
            true
          );
        }
        return;
      }

      currentSources = playable;
      setSourceStatus(`${playable.length} fonti riproducibili su Comet`);
      playSource(0);
    } catch (error) {
      if (requestId !== authorizedStreamRequest) return;

      if (error.name === 'AbortError') {
        setSourceStatus(`Comet non ha risposto in ${STREAM_TIMEOUT_MS / 1000}s.`, true);
        setAnimePlayerStatus('Timeout: riprova o configura COMET_PROXY.', true);
      } else if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
        setSourceStatus('Richiesta bloccata da CORS/rete.', true);
        setAnimePlayerStatus('Cambia COMET_BASE o configura COMET_PROXY.', true);
      } else {
        setSourceStatus(`Scraping non riuscito: ${error.message}`, true);
        setAnimePlayerStatus('Controlla che Comet sia raggiungibile.', true);
      }
    }
  }

  /* ---------------- Lista episodi con paginazione ---------------- */
  const episodeState = { anime: null, shown: 0, total: null };

  function renderEpisodeButtons() {
    const { anime, total } = episodeState;
    if (!anime || !animeEpisodeList) return;

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
        playAuthorizedEpisode(anime, episode);
      });
      animeEpisodeList.append(button);
    }

    const remaining = total === null ? EPISODES_PER_PAGE : total - episodeState.shown;
    if (remaining > 0) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'episode-more-btn';
      more.textContent = `+ altri ${Math.min(EPISODES_PER_PAGE, remaining)}`;
      more.title = 'Mostra altri episodi';
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

    const episodeCount = Number(anime.episodes);
    const hasCount = Number.isInteger(episodeCount) && episodeCount > 0;

    currentAnime = anime;
    currentEpisode = 1;
    episodeState.anime = anime;
    episodeState.total = hasCount ? episodeCount : null;
    episodeState.shown = hasCount ? Math.min(episodeCount, EPISODES_PER_PAGE) : 12;
    renderEpisodeButtons();

    setAnimePlayerStatus('Seleziona un episodio per avviare lo scraping delle fonti.');
    animePlayerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (closeAnimePlayer) {
    closeAnimePlayer.addEventListener('click', () => {
      authorizedStreamRequest++;
      resetVideoPlayer();
      animePlayerPanel.hidden = true;
    });
  }

  /* ---------------- Utente ---------------- */
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

        document.querySelectorAll('.anime-card').forEach(card => {
          const malId = card.dataset.id;
          const favBtn = card.querySelector('.fav-btn');
          if (favBtn && malId) {
            const favs = getFavorites();
            const isFav = favs.some(f => String(f.mal_id) === String(malId));
            favBtn.classList.toggle('active-fav', isFav);
            favBtn.textContent = isFav ? '⭐ Salvato' : '☆ Preferito';
          }
        });

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

  /* ---------------- Tab ---------------- */
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

  /* ---------------- Card ---------------- */
  function createAnimeCard(anime) {
    const favs = getFavorites();
    const isFav = favs.some(f => String(f.mal_id) === String(anime.mal_id));

    const card = document.createElement('article');
    card.className = 'anime-card';
    card.dataset.id = anime.mal_id;

    const image = document.createElement('img');
    image.className = 'anime-poster';
    image.src = anime.images?.jpg?.image_url || '';
    image.alt = anime.title || 'Copertina anime';
    image.loading = 'lazy';
    image.decoding = 'async';

    const info = document.createElement('div');
    info.className = 'anime-info';
    const title = document.createElement('h3');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Titolo non disponibile';
    const metadata = document.createElement('p');
    metadata.style.cssText = 'font-size: 0.8rem; opacity: 0.7; margin: 0;';
    metadata.textContent = `⭐ ${anime.score ?? 'N/D'} | 📺 ${anime.episodes ?? '?'} ep`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const playerButton = document.createElement('button');
    playerButton.className = 'watch-btn';
    playerButton.type = 'button';
    playerButton.textContent = 'Apri player';
    playerButton.addEventListener('click', () => openAuthorizedPlayer(anime));

    const detailsLink = document.createElement('a');
    detailsLink.className = 'fav-btn';
    detailsLink.href = anime.url || `https://kitsu.io/anime?filter[text]=${encodeURIComponent(anime.title || '')}`;
    detailsLink.target = '_blank';
    detailsLink.rel = 'noopener noreferrer';
    detailsLink.textContent = 'Apri scheda';

    const favBtn = document.createElement('button');
    favBtn.className = `fav-btn${isFav ? ' active-fav' : ''}`;
    favBtn.type = 'button';
    favBtn.textContent = isFav ? '⭐ Salvato' : '☆ Preferito';

    actions.append(playerButton, detailsLink, favBtn);
    info.append(title, metadata, actions);
    card.append(image, info);

    favBtn.addEventListener('click', () => {
      let currentFavs = getFavorites();
      const index = currentFavs.findIndex(f => String(f.mal_id) === String(anime.mal_id));

      if (index > -1) {
        currentFavs.splice(index, 1);
      } else {
        currentFavs.push({
          mal_id: anime.mal_id,
          title: anime.title,
          images: anime.images,
          score: anime.score,
          episodes: anime.episodes,
          url: anime.url
        });
      }

      try {
        localStorage.setItem(getFavoritesKey(), JSON.stringify(currentFavs));
      } catch {
        return;
      }
      const isNowFavorite = index === -1;
      favBtn.classList.toggle('active-fav', isNowFavorite);
      favBtn.textContent = isNowFavorite ? '⭐ Salvato' : '☆ Preferito';
      updateFavCounter();
      const watchlistTab = document.getElementById('tab-watchlist');
      if (watchlistTab && !watchlistTab.hidden) loadWatchlist();
    });

    return card;
  }

  /* ---------------- Ricerca Kitsu ---------------- */
  let activeSearchController;

  async function searchAnime(query) {
    const term = query.trim();
    if (!searchGrid) return;
    if (!term) {
      searchGrid.textContent = 'Scrivi un titolo per avviare la ricerca.';
      return;
    }

    activeSearchController?.abort();
    const controller = new AbortController();
    activeSearchController = controller;
    const loading = document.createElement('p');
    loading.textContent = 'Ricerca in corso…';
    searchGrid.replaceChildren(loading);
    searchBtn.disabled = true;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    try {
      const url = `${KITSU_API}/anime?filter[text]=${encodeURIComponent(term)}&page[limit]=20`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.api+json' },
      });
      if (!res.ok) throw new Error(`Kitsu ha risposto ${res.status}`);
      const data = await res.json();
      if (controller.signal.aborted) return;
      searchGrid.replaceChildren();
      if (Array.isArray(data.data) && data.data.length > 0) {
        data.data.forEach(item => {
          const attributes = item.attributes || {};
          const titles = attributes.titles || {};
          const anime = {
            mal_id: `kitsu-${item.id}`,
            title: attributes.canonicalTitle || titles.en || titles.en_jp || titles.ja_jp || 'Titolo non disponibile',
            images: { jpg: { image_url: attributes.posterImage?.small || attributes.posterImage?.medium || '' } },
            score: attributes.averageRating ? (Number(attributes.averageRating) / 10).toFixed(1) : null,
            episodes: attributes.episodeCount,
            url: attributes.slug ? `https://kitsu.io/anime/${attributes.slug}` : `https://kitsu.io/anime/${item.id}`,
          };
          searchGrid.appendChild(createAnimeCard(anime));
        });
      } else {
        searchGrid.textContent = `Nessun anime trovato per "${term}".`;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (timedOut && activeSearchController === controller) {
          searchGrid.textContent = 'La ricerca sta impiegando troppo tempo. Riprova tra poco.';
        }
      } else {
        const detail = err.message || 'errore di rete o CORS';
        searchGrid.textContent = `Ricerca non riuscita (${detail}). Riprova tra poco.`;
      }
    } finally {
      clearTimeout(timeoutId);
      if (activeSearchController === controller) {
        activeSearchController = null;
        searchBtn.disabled = false;
      }
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