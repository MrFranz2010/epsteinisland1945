document.addEventListener('DOMContentLoaded', () => {
  /* ============================================================
     CONFIGURAZIONE COMET (scraping fonti)
     - COMET_BASE: la tua istanza Comet (self-hosted o pubblica).
     - COMET_CONFIG: b64config copiato dall'URL del manifest di /configure.
     - COMET_PROXY: se la CORS blocca, endpoint tuo che inoltra:
         fetch(decodeURIComponent(req.query.url))
       e qui metti 'https://esempio/api/comet?url='
     ============================================================ */
  const COMET_BASE = 'https://comet.elfhosted.com';
  const COMET_CONFIG = '';
  const COMET_PROXY = '';

  const KITSU_API = 'https://kitsu.io/api/edge';
  const KITSU_CACHE_PREFIX = 'epstein_kitsu_';
  const FALLBACK_SRC = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

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
     COMET: id Kitsu e scraping degli stream
     ============================================================ */

  function cometUrl(path) {
    const base = `${COMET_BASE.replace(/\/$/, '')}${COMET_CONFIG ? '/' + COMET_CONFIG : ''}`;
    const full = `${base}${path}`;
    return COMET_PROXY ? `${COMET_PROXY}${encodeURIComponent(full)}` : full;
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

  function streamText(stream) {
    const hint = stream.behaviorHints && stream.behaviorHints.filename ? stream.behaviorHints.filename : '';
    return `${stream.name || ''} ${stream.title || ''} ${hint}`.toLowerCase();
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

  async function fetchStreams(anime, episode) {
    const kitsuId = await kitsuIdFor(anime);
    if (!kitsuId) throw new Error('nessun id Kitsu trovato per questo titolo');

    const res = await fetch(cometUrl(`/stream/series/kitsu:${kitsuId}:${episode}.json`));
    if (!res.ok) throw new Error(`Comet ha risposto ${res.status}`);

    const data = await res.json();
    const all = (data.streams || []).filter(s => s && (s.url || s.infoHash));
    const playable = all.filter(s => typeof s.url === 'string' && s.url);
    playable.sort((a, b) => streamScore(b) - streamScore(a));
    return { playable, total: all.length };
  }

  function renderSources() {
    if (!sourceList) return;
    sourceList.replaceChildren();
    currentSources.forEach((stream, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${stream.name || 'Fonte'} ${index + 1}`;
      button.title = `${stream.title || stream.name || ''}`.trim();
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

  function playSource(index) {
    const stream = currentSources[index];
    if (!stream || !authorizedVideoPlayer) return;
    currentSourceIndex = index;
    renderSources();

    const href = String(stream.url);
    if (/\.m3u8($|\?)/i.test(href) && authorizedVideoPlayer.canPlayType('application/vnd.apple.mpegurl') === '') {
      setAnimePlayerStatus('Fonte HLS: questo browser non la riproduce senza un player HLS.', true);
    }

    authorizedVideoPlayer.src = href;
    authorizedVideoPlayer.play()
      .then(() => setAnimePlayerStatus(`Riproduzione episodio ${currentEpisode} (${stream.name || 'fonte'}).`))
      .catch(() => setAnimePlayerStatus(`Episodio ${currentEpisode}: premi play per avviare (${stream.name || 'fonte'}).`));
  }

  /* Se una fonte muore a metà, passo alla successiva */
  if (authorizedVideoPlayer) {
    authorizedVideoPlayer.addEventListener('error', () => {
      if (!currentAnime || currentSourceIndex < 0 || !currentSources.length) return;
      if (currentSourceIndex + 1 < currentSources.length) {
        setAnimePlayerStatus('Fonte non riproducibile, passo alla successiva…');
        playSource(currentSourceIndex + 1);
      } else {
        setAnimePlayerStatus(`Nessuna fonte riproducibile per l'episodio ${currentEpisode}.`, true);
      }
    });
  }

  async function playAuthorizedEpisode(anime, episode) {
    const requestId = ++authorizedStreamRequest;
    currentAnime = anime;
    currentEpisode = episode;
    currentSources = [];
    currentSourceIndex = -1;

    if (sourcePanel) sourcePanel.hidden = false;
    if (sourceList) sourceList.replaceChildren();

    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');

    setAnimePlayerStatus(`Cerco le fonti su Comet per l'episodio ${episode}…`);
    setSourceStatus('Fonti da Comet');

    try {
      const { playable, total } = await fetchStreams(anime, episode);
      if (requestId !== authorizedStreamRequest) return;

      if (!playable.length) {
        setSourceStatus(`Nessuna fonte riproducibile (${total} torrent senza link diretto).`, true);
        setAnimePlayerStatus('Comet ha trovato solo torrent con infoHash: attiva PROXY_DEBRID_STREAM o un debrid.', true);
        return;
      }

      currentSources = playable;
      setSourceStatus(`${playable.length} fonti riproducibili su Comet`);
      playSource(0);
    } catch (error) {
      if (requestId !== authorizedStreamRequest) return;
      const detail = error.message || 'errore sconosciuto';
      setSourceStatus(`Scraping non riuscito: ${detail}`, true);
      setAnimePlayerStatus('Controlla che Comet sia raggiungibile (CORS) o configura COMET_PROXY.', true);
    }
  }

  function openAuthorizedPlayer(anime) {
    animePlayerPanel.hidden = false;
    animePlayerTitle.textContent = anime.title || 'Anime';
    animeEpisodeList.replaceChildren();
    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');
    if (sourcePanel) sourcePanel.hidden = true;
    if (sourceList) sourceList.replaceChildren();

    const episodeCount = Number(anime.episodes);
    const totalEpisodes = Number.isInteger(episodeCount) && episodeCount > 0
      ? Math.min(episodeCount, 50)
      : 12;

    for (let episode = 1; episode <= totalEpisodes; episode++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Ep ${episode}`;
      button.setAttribute('aria-pressed', String(episode === 1));
      button.addEventListener('click', () => {
        animeEpisodeList.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        playAuthorizedEpisode(anime, episode);
      });
      animeEpisodeList.append(button);
    }
    setAnimePlayerStatus('Seleziona un episodio per avviare lo scraping delle fonti.');
    animePlayerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (closeAnimePlayer) {
    closeAnimePlayer.addEventListener('click', () => {
      authorizedStreamRequest++;
      authorizedVideoPlayer.pause();
      authorizedVideoPlayer.removeAttribute('src');
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
      const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(term)}&page[limit]=20`;
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