document.addEventListener('DOMContentLoaded', () => {
  /* ============================================================
     CONFIGURAZIONE COMET
     - COMET_BASE: la tua istanza Comet (self-hosted o pubblica).
     - COMET_CONFIG: il b64config copiato dall'URL del manifest
       generato da /configure (lascia vuoto se non serve).
     - COMET_PROXY: opzionale, se il browser viene bloccato dalla
       CORS usa un tuo endpoint che inoltra la richiesta.
       Es. 'https://epsteinsbackend.onrender.com/api/comet?url='
       e sul backend fai: fetch(decodeURIComponent(req.query.url))
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

  function setAnimePlayerStatus(message, isError = false) {
    animePlayerStatus.textContent = message;
    animePlayerStatus.dataset.error = String(isError);
  }

  async function playAuthorizedEpisode(anime, episode) {
    const requestId = ++authorizedStreamRequest;
    setAnimePlayerStatus(`Caricamento episodio ${episode}…`);
    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');

    try {
      const resolver = window.resolveAuthorizedAnimeStream;
      if (typeof resolver !== 'function') {
        throw new Error('Nessuna sorgente autorizzata configurata.');
      }
      const stream = await resolver({
        animeId: String(anime.mal_id),
        title: anime.title,
        episode,
      });
      if (requestId !== authorizedStreamRequest) return;
      if (!stream || typeof stream.url !== 'string') {
        throw new Error('Il provider non ha restituito uno stream per questo episodio.');
      }

      const streamUrl = new URL(stream.url);
      if (!['http:', 'https:'].includes(streamUrl.protocol)) {
        throw new Error('Il provider ha restituito un URL non supportato.');
      }
      if (stream.type === 'hls' && !authorizedVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        throw new Error('Questo browser non supporta HLS nativo; serve un player HLS autorizzato.');
      }

      authorizedVideoPlayer.src = streamUrl.href;
      await authorizedVideoPlayer.play();
      setAnimePlayerStatus(`Riproduzione episodio ${episode}.`);
    } catch (error) {
      if (requestId === authorizedStreamRequest) {
        setAnimePlayerStatus(error.message || 'Impossibile riprodurre questo episodio.', true);
      }
    }
  }

  function openAuthorizedPlayer(anime) {
    animePlayerPanel.hidden = false;
    animePlayerTitle.textContent = anime.title || 'Anime';
    animeEpisodeList.replaceChildren();
    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');
    const episodeCount = Number(anime.episodes);
    const totalEpisodes = Number.isInteger(episodeCount) && episodeCount > 0
      ? Math.min(episodeCount, 50)
      : 1;

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
    setAnimePlayerStatus('Seleziona un episodio; la riproduzione richiede un provider autorizzato configurato.');
    animePlayerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  closeAnimePlayer.addEventListener('click', () => {
    authorizedStreamRequest++;
    authorizedVideoPlayer.pause();
    authorizedVideoPlayer.removeAttribute('src');
    animePlayerPanel.hidden = true;
  });

  const playerSection = document.getElementById('playerSection');
  const playerTitle = document.getElementById('playerTitle');
  const animeVideoPlayer = document.getElementById('animeVideoPlayer');
  const episodeList = document.getElementById('episodeList');
  const closePlayerBtn = document.getElementById('closePlayerBtn');

  /* Pannello fonti creato via JS: nessuna modifica a index.html */
  const sourcePanel = document.createElement('div');
  sourcePanel.id = 'sourcePanel';
  sourcePanel.hidden = true;
  const sourceStatus = document.createElement('p');
  sourceStatus.id = 'sourceStatus';
  sourceStatus.style.cssText = 'margin: 0 0 8px; font-size: 0.9rem; opacity: 0.8;';
  const sourceList = document.createElement('div');
  sourceList.id = 'sourceList';
  sourceList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
  sourcePanel.append(sourceStatus, sourceList);
  if (playerSection) {
    const container = playerSection.querySelector('.player-container');
    if (container) container.after(sourcePanel);
    else playerSection.append(sourcePanel);
  }

  let currentAnime = null;
  let currentEpisode = 1;
  let currentSources = [];
  let currentSourceIndex = -1;
  let streamRequest = 0;

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
            if (isFav) {
              favBtn.classList.add('active-fav');
              favBtn.textContent = '⭐ Salvato';
            } else {
              favBtn.classList.remove('active-fav');
              favBtn.textContent = '☆ Preferito';
            }
          }
        });

        const watchlistTab = document.getElementById('tab-watchlist');
        if (watchlistTab && !watchlistTab.hidden) {
          loadWatchlist();
        }
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
        if (tab.dataset.tab === 'watchlist') {
          loadWatchlist();
        }
      }
    });
  });

  /* ============================================================
     COMET: risoluzione id e scraping degli stream
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
    } catch { /* quota piena: pazienza */ }
  }

  /* MyAnimeList id -> Kitsu id tramite i mappings pubblici di Kitsu */
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

  /* Fallback: cerca l'anime su Kitsu per titolo */
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

  function streamText(stream) {
    return `${stream.name || ''} ${stream.title || ''} ${(stream.behaviorHints && stream.behaviorHints.filename) || ''}`.toLowerCase();
  }

  /* Preferisce link diretti (debrid/proxystream) e poi la qualità */
  function streamScore(stream) {
    const text = streamText(stream);
    let score = 0;
    if (stream.url) score += 1000;
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
    const kitsuId = (await kitsuIdFromMal(anime.mal_id)) || (await kitsuIdFromTitle(anime.title));
    if (!kitsuId) throw new Error('nessun id Kitsu trovato per questo titolo');

    const res = await fetch(cometUrl(`/stream/series/kitsu:${kitsuId}:${episode}.json`));
    if (!res.ok) throw new Error(`Comet ha risposto ${res.status}`);

    const data = await res.json();
    const streams = (data.streams || []).filter(s => s && (s.url || s.infoHash));
    streams.sort((a, b) => streamScore(b) - streamScore(a));
    return streams;
  }

  function setSourceStatus(message, isError = false) {
    sourceStatus.textContent = message;
    sourceStatus.style.color = isError ? '#cc3300' : 'inherit';
  }

  function renderSources(anime, episode) {
    sourceList.innerHTML = '';
    currentSources.forEach((stream, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'comet-source';
      btn.textContent = `${stream.url ? '▶' : '⛓'} ${stream.name || 'Fonte'} ${index + 1}`;
      btn.title = `${stream.title || ''}${stream.url ? '' : ' (solo infoHash)'}`;
      btn.style.cssText = 'padding: 6px 10px; font-size: 0.8rem; border-radius: 4px; cursor: pointer; ' +
                          'border: 1px solid currentColor; background: transparent; color: inherit; max-width: 260px; ' +
                          'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      if (index === currentSourceIndex) {
        btn.style.background = '#0066cc';
        btn.style.color = '#fff';
        btn.style.borderColor = '#0066cc';
      }
      btn.addEventListener('click', () => playSource(anime, episode, index));
      sourceList.append(btn);
    });
  }

  function playSource(anime, episode, index) {
    const stream = currentSources[index];
    if (!stream || !animeVideoPlayer) return;
    currentSourceIndex = index;
    renderSources(anime, episode);

    if (stream.url) {
      setSourceStatus(`Riproduzione: ${stream.name || 'fonte'} — ep. ${episode}`);
      animeVideoPlayer.src = stream.url;
      animeVideoPlayer.play().catch(() => {});
      return;
    }

    setSourceStatus(`Fonte ep. ${episode}: solo infoHash, nessun link diretto. Provo la successiva.`);
    const nextIndex = index + 1;
    if (nextIndex < currentSources.length) {
      playSource(anime, episode, nextIndex);
    } else {
      setSourceStatus(`Nessuna fonte riproducibile direttamente per l'episodio ${episode}. ` +
                      'Serve un debrid o PROXY_DEBRID_STREAM attivo su Comet.', true);
      animeVideoPlayer.src = FALLBACK_SRC;
      animeVideoPlayer.play().catch(() => {});
    }
  }

  async function playEpisode(anime, episode) {
    if (!animeVideoPlayer) return;
    currentAnime = anime;
    currentEpisode = episode;
    currentSources = [];
    currentSourceIndex = -1;
    const request = ++streamRequest;

    sourcePanel.hidden = false;
    sourceList.innerHTML = '';
    setSourceStatus(`Scraping delle fonti su Comet per l'episodio ${episode}...`);
    if (playerTitle) playerTitle.textContent = `${anime.title} — Episodio ${episode}`;

    animeVideoPlayer.pause();
    animeVideoPlayer.removeAttribute('src');

    try {
      const streams = await fetchStreams(anime, episode);
      if (request !== streamRequest) return;
      if (!streams.length) {
        setSourceStatus('Comet non ha trovato fonti per questo episodio.', true);
        animeVideoPlayer.src = FALLBACK_SRC;
        animeVideoPlayer.play().catch(() => {});
        return;
      }
      currentSources = streams;
      setSourceStatus(`${streams.length} fonti trovate da Comet per l'episodio ${episode}.`);
      playSource(anime, episode, 0);
    } catch (error) {
      if (request !== streamRequest) return;
      setSourceStatus(`Scraping non riuscito: ${error.message || 'errore sconosciuto'}. ` +
                      'Controlla che Comet sia raggiungibile (CORS) o configura COMET_PROXY.', true);
      animeVideoPlayer.src = FALLBACK_SRC;
      animeVideoPlayer.play().catch(() => {});
    }
  }

  /* Se una fonte muore a metà, passo alla successiva */
  if (animeVideoPlayer) {
    animeVideoPlayer.addEventListener('error', () => {
      if (!currentAnime || currentSourceIndex < 0) return;
      if (currentSourceIndex + 1 < currentSources.length) {
        setSourceStatus('Fonte non riproducibile, passo alla successiva...');
        playSource(currentAnime, currentEpisode, currentSourceIndex + 1);
      }
    });
  }

  /* ---------------- Player ---------------- */
  function openPlayer(anime) {
    if (playerSection) playerSection.hidden = false;
    if (playerTitle) playerTitle.textContent = anime.title;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let totalEpisodes = anime.episodes || 24;
    if (totalEpisodes > 50) totalEpisodes = 50;
    if (!totalEpisodes || totalEpisodes < 1) totalEpisodes = 12;

    if (episodeList) episodeList.innerHTML = '';

    for (let i = 1; i <= totalEpisodes; i++) {
      const epBtn = document.createElement('button');
      epBtn.className = `episode-btn ${i === 1 ? 'active' : ''}`;
      epBtn.textContent = `Ep ${i}`;

      epBtn.addEventListener('click', () => {
        document.querySelectorAll('.episode-btn').forEach(b => b.classList.remove('active'));
        epBtn.classList.add('active');
        playEpisode(anime, i);
      });
      if (episodeList) episodeList.append(epBtn);
    }

    const firstEpBtn = episodeList ? episodeList.querySelector('.episode-btn') : null;
    if (firstEpBtn) firstEpBtn.click();
  }

  if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', () => {
      if (playerSection) playerSection.hidden = true;
      streamRequest++;
      if (sourcePanel) sourcePanel.hidden = true;
      if (animeVideoPlayer) {
        animeVideoPlayer.pause();
        animeVideoPlayer.removeAttribute('src');
      }
    });
  }

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
    const detailsLink = document.createElement('a');
    detailsLink.className = 'watch-btn';
    detailsLink.href = anime.url || `https://myanimelist.net/anime.php?q=${encodeURIComponent(anime.title || '')}`;
    detailsLink.target = '_blank';
    detailsLink.rel = 'noopener noreferrer';
    detailsLink.textContent = 'Apri scheda';

    const availabilityLink = document.createElement('a');
    availabilityLink.className = 'fav-btn';
    availabilityLink.href = `https://www.justwatch.com/it/ricerca?q=${encodeURIComponent(anime.title || '')}`;
    availabilityLink.target = '_blank';
    availabilityLink.rel = 'noopener noreferrer';
    availabilityLink.textContent = 'Dove guardarlo';

    const playerButton = document.createElement('button');
    playerButton.className = 'watch-btn';
    playerButton.type = 'button';
    playerButton.textContent = 'Apri player';
    playerButton.addEventListener('click', () => openPlayer(anime));

    const favBtn = document.createElement('button');
    favBtn.className = `fav-btn${isFav ? ' active-fav' : ''}`;
    favBtn.type = 'button';
    favBtn.textContent = isFav ? '⭐ Salvato' : '☆ Preferito';
    actions.append(playerButton, detailsLink, availabilityLink, favBtn);
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