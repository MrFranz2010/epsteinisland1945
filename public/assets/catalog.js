import { games, gamePage } from './games.js';

const gameList = document.getElementById('gameList');
const searchGames = document.getElementById('searchGames');
const filterCategory = document.getElementById('filterCategory');
const gameCount = document.getElementById('gameCount');
const emptyState = document.getElementById('emptyState');

for (const category of [...new Set(games.map((game) => game.category))].sort()) {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  filterCategory.append(option);
}

function createCard(game) {
  const link = document.createElement('a');
  link.className = 'game-card';
  link.href = gamePage(game);
  const artwork = document.createElement('div');
  artwork.className = 'game-artwork';
  if (game.cover) {
    const image = document.createElement('img');
    image.src = game.cover;
    image.alt = game.coverAlt || game.title;
    image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    artwork.append(image);
  }
  const body = document.createElement('div');
  body.className = 'game-card-body';
  const category = document.createElement('span');
  category.className = 'eyebrow';
  category.textContent = game.category;
  const title = document.createElement('h3');
  title.textContent = game.title;
  const description = document.createElement('p');
  description.textContent = game.description;
  const action = document.createElement('span');
  action.className = 'card-action';
  action.textContent = 'Gioca ora →';
  body.append(category, title, description, action);
  link.append(artwork, body);
  return link;
}

function renderGames() {
  const search = searchGames.value.trim().toLocaleLowerCase('it');
  const visibleGames = games.filter((game) => {
    const matchesSearch = `${game.title} ${game.category}`.toLocaleLowerCase('it').includes(search);
    return matchesSearch && (!filterCategory.value || game.category === filterCategory.value);
  });
  gameList.replaceChildren(...visibleGames.map(createCard));
  emptyState.hidden = visibleGames.length > 0;
  gameCount.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'gioco disponibile' : 'giochi disponibili'}`;
}

searchGames.addEventListener('input', renderGames);
filterCategory.addEventListener('change', renderGames);
renderGames();
