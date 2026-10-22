document.addEventListener('DOMContentLoaded', () => {
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

  // Gestione Utente
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

  // Cambio Tab
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

  // Apertura Player
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
        
        if (animeVideoPlayer) {
          animeVideoPlayer.src = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
          animeVideoPlayer.play().catch(() => {});
        }
      });
      if (episodeList) episodeList.appendChild(epBtn);
    }

    const firstEpBtn = episodeList ? episodeList.querySelector('.episode-btn') : null;
    if (firstEpBtn) firstEpBtn.click();
  }

  if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', () => {
      if (playerSection) playerSection.hidden = true;
      if (animeVideoPlayer) {
        animeVideoPlayer.pause();
        animeVideoPlayer.src = '';
      }
    });
  }

  // Creazione Card Anime
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

  async function searchAnime(query) {
    const term = query.trim();
    if (!term) return;
    
    if (searchGrid) searchGrid.innerHTML = '<p>Ricerca globale in corso...</p>';

    // Usa sempre il backend online su Render
    const BACKEND_URL = 'https://epsteinsbackend.onrender.com';

    console.log("Invio richiesta a:", `${BACKEND_URL}/api/search?q=${encodeURIComponent(term)}`);

    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(term)}`);
      
      if (!res.ok) throw new Error(`Errore HTTP: ${res.status}`);
      
      const data = await res.json();
      console.log("Dati ricevuti dal backend:", data);

      if (searchGrid) {
        searchGrid.innerHTML = '';
        if (data && data.data && data.data.length > 0) {
          data.data.forEach(anime => searchGrid.appendChild(createAnimeCard(anime)));
        } else {
          searchGrid.innerHTML = `<p>Nessun anime trovato per "${query}".</p>`;
        }
      }
    } catch (err) {
      console.error("Errore durante la fetch:", err);
      if (searchGrid) {
        searchGrid.innerHTML = `<p style="color: red;">Errore di connessione al backend (${err.message}). Se usi Render, il server potrebbe essere in fase di attivazione, riprova tra qualche secondo.</p>`;
      }
    }
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
  
  // Mostra i titoli di default all'avvio nella sezione di ricerca
  if (searchGrid) {
    searchGrid.innerHTML = '';
    animeDatabase.forEach(anime => searchGrid.appendChild(createAnimeCard(anime)));
  }
});