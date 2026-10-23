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

    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.id = anime.mal_id;
    card.innerHTML = `
      <img class="anime-poster" src="${anime.images?.jpg?.image_url || ''}" alt="${anime.title}">
      <div class="anime-info">
        <div>
          <h3 class="anime-title" title="${anime.title}">${anime.title}</h3>
          <p style="font-size: 0.8rem; opacity: 0.7; margin: 0;">⭐ ${anime.score || 'N/D'} | 📺 ${anime.episodes || '?'} ep</p>
        </div>
        <div class="card-actions">
          <button class="watch-btn" type="button">▶ Guarda</button>
          <button class="fav-btn ${isFav ? 'active-fav' : ''}" type="button">
            ${isFav ? '⭐ Salvato' : '☆ Preferito'}
          </button>
        </div>
      </div>
    `;

    card.querySelector('.watch-btn').addEventListener('click', () => openPlayer(anime));

    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', () => {
      let currentFavs = getFavorites();
      const index = currentFavs.findIndex(f => String(f.mal_id) === String(anime.mal_id));

      if (index > -1) {
        currentFavs.splice(index, 1);
        favBtn.classList.remove('active-fav');
        favBtn.textContent = '☆ Preferito';
      } else {
        currentFavs.push({
          mal_id: anime.mal_id,
          title: anime.title,
          images: anime.images,
          score: anime.score,
          episodes: anime.episodes
        });
        favBtn.classList.add('active-fav');
        favBtn.textContent = '⭐ Salvato';
      }

      localStorage.setItem(getFavoritesKey(), JSON.stringify(currentFavs));
      updateFavCounter();
      const watchlistTab = document.getElementById('tab-watchlist');
      if (watchlistTab && !watchlistTab.hidden) loadWatchlist();
    });

    return card;
  }

  /* ---------------- Ricerca (invariata) ---------------- */
  async function searchAnime(query) {
    const term = query.trim();
    if (!term) return;

    if (searchGrid) searchGrid.innerHTML = '<p>Ricerca globale in corso...</p>';

    const BACKEND_URL = 'https://epsteinsbackend.onrender.com';

    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error('Errore di comunicazione con il server');

      const data = await res.json();

      if (searchGrid) {
        searchGrid.innerHTML = '';
        if (data && data.data && data.data.length > 0) {
          data.data.forEach(anime => searchGrid.appendChild(createAnimeCard(anime)));
        } else {
          searchGrid.innerHTML = `<p>Nessun anime trovato per "${query}".</p>`;
        }
      }
    } catch (err) {
      if (searchGrid) {
        searchGrid.innerHTML = `<p style="color: red;">Errore di connessione al backend. Se il server su Render era in pausa, riprova tra qualche secondo.</p>`;
      }
    }
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => searchAnime(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
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