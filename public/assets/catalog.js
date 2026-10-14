import { games, gamePage, siteUrl } from './games.js';

const gameList = document.getElementById('gameList');
const searchGames = document.getElementById('searchGames');
const filterCategory = document.getElementById('filterCategory');
const filterInput = document.getElementById('filterInput');
const filterRequirement = document.getElementById('filterRequirement');
const filterFavorites = document.getElementById('filterFavorites');
const gameCount = document.getElementById('gameCount');
const emptyState = document.getElementById('emptyState');
const newGames = document.getElementById('newGames');
const noNews = document.getElementById('noNews');
const recentSection = document.getElementById('recentSection');
const recentGames = document.getElementById('recentGames');
const favoriteGames = document.getElementById('favoriteGames');
const emptyFavorites = document.getElementById('emptyFavorites');
const catalogStatus = document.getElementById('catalogStatus');

const storageKeys = {
  favorites: 'epstein-island:favorites',
  recent: 'epstein-island:recent',
};
const newsWindow = 30 * 24 * 60 * 60 * 1000;
const gameBySlug = new Map(games.map((game) => [game.slug, game]));
const inputLabels = {
  touch: 'Touch',
  keyboard: 'Tastiera',
  mouse: 'Mouse',
  controller: 'Controller',
};
const requirementLabels = {
  webgl: 'WebGL',
  internet: 'Internet',
};
const storageFailures = new Set();
let favorites = new Set();
let recent = [];

for (const category of [...new Set(games.map((game) => game.category))].sort()) {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  filterCategory.append(option);
}

function reportStorageError(error, action, key) {
  storageFailures.add(key);
  console.error(`Impossibile ${action} i dati del catalogo sul dispositivo.`, error);
  catalogStatus.textContent = `Non è stato possibile ${action} i dati nel browser. Preferiti e giochi recenti potrebbero non essere conservati su questo dispositivo.`;
  catalogStatus.dataset.error = 'true';
}

function readSavedList(key, limit) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new TypeError(`Il dato salvato in ${key} non è una lista.`);
    return [...new Set(parsed.filter((slug) => typeof slug === 'string' && gameBySlug.has(slug)))].slice(0, limit);
  } catch (error) {
    reportStorageError(error, 'leggere', key);
    return [];
  }
}

function saveList(key, values, action) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
    storageFailures.delete(key);
    if (storageFailures.size === 0) {
      catalogStatus.textContent = '';
      delete catalogStatus.dataset.error;
    }
  } catch (error) {
    reportStorageError(error, action, key);
  }
}

function loadSavedState() {
  favorites = new Set(readSavedList(storageKeys.favorites, games.length));
  recent = readSavedList(storageKeys.recent, 6);
}

function rememberRecent(game) {
  recent = [game.slug, ...recent.filter((slug) => slug !== game.slug)].slice(0, 6);
  saveList(storageKeys.recent, recent, 'salvare');
  renderPersonalLists();
}

function makeGameLink(game, text, className) {
  const link = document.createElement('a');
  link.href = gamePage(game);
  link.className = className;
  link.textContent = text;
  link.addEventListener('click', () => rememberRecent(game));
  return link;
}

function makeTag(text, className = '') {
  const tag = document.createElement('span');
  tag.className = `game-tag ${className}`.trim();
  tag.textContent = text;
  return tag;
}

function isNew(game) {
  return game.addedAt && Date.parse(game.addedAt) >= Date.now() - newsWindow;
}

function createCard(game) {
  const card = document.createElement('article');
  card.className = 'game-card';

  const artworkLink = makeGameLink(game, '', 'game-artwork');
  artworkLink.setAttribute('aria-label', `Apri ${game.title}`);
  if (game.cover) {
    const image = document.createElement('img');
    image.src = siteUrl(game.cover);
    image.alt = game.coverAlt || game.title;
    image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    artworkLink.append(image);
  }

  const body = document.createElement('div');
  body.className = 'game-card-body';

  const topLine = document.createElement('div');
  topLine.className = 'game-card-topline';
  const category = document.createElement('span');
  category.className = 'category-tag';
  category.textContent = game.category;
  const favoriteButton = document.createElement('button');
  favoriteButton.className = 'favorite-button';
  favoriteButton.type = 'button';
  favoriteButton.setAttribute('aria-label', favorites.has(game.slug)
    ? `Rimuovi ${game.title} dai preferiti`
    : `Aggiungi ${game.title} ai preferiti`);
  favoriteButton.setAttribute('aria-pressed', String(favorites.has(game.slug)));
  favoriteButton.textContent = favorites.has(game.slug) ? '★' : '☆';
  favoriteButton.addEventListener('click', () => {
    if (favorites.has(game.slug)) favorites.delete(game.slug);
    else favorites.add(game.slug);
    const values = [...favorites];
    saveList(storageKeys.favorites, values, 'salvare');
    renderGames();
    renderPersonalLists();
  });
  topLine.append(category, favoriteButton);

  const title = document.createElement('h3');
  title.append(makeGameLink(game, game.title, 'game-title-link'));
  const description = document.createElement('p');
  description.textContent = game.description;

  const tags = document.createElement('div');
  tags.className = 'game-tags';
  for (const input of game.inputs) {
    tags.append(makeTag(inputLabels[input] || input, 'input-tag'));
  }
  for (const requirement of game.requirements) {
    tags.append(makeTag(`Richiede ${requirementLabels[requirement] || requirement}`, 'requirement-tag'));
  }
  if (isNew(game)) tags.append(makeTag('Novità', 'new-tag'));

  const controls = document.createElement('p');
  controls.className = 'game-card-controls';
  controls.textContent = game.controls?.slice(0, 2).join(' ');

  const cardFooter = document.createElement('div');
  cardFooter.className = 'game-card-footer';
  if (game.author) {
    const authorName = document.createElement('span');
    authorName.className = 'game-author';
    authorName.textContent = `Di ${game.author}`;
    cardFooter.append(authorName);
  }
  if (game.authorUrl) {
    const author = document.createElement('a');
    author.href = game.authorUrl;
    author.target = '_blank';
    author.rel = 'noopener noreferrer';
    author.className = 'game-author';
    author.textContent = 'Fonte ↗';
    author.addEventListener('click', (event) => event.stopPropagation());
    cardFooter.append(author);
  }
  cardFooter.append(makeGameLink(game, 'Gioca ora →', 'card-action'));

  body.append(topLine, title, description, tags);
  if (controls.textContent) body.append(controls);
  body.append(cardFooter);
  card.append(artworkLink, body);
  return card;
}

function renderList(container, list) {
  container.replaceChildren(...list.map(createCard));
}

function renderGames() {
  const search = searchGames.value.trim().toLocaleLowerCase('it');
  const visibleGames = games.filter((game) => {
    const searchableText = `${game.title} ${game.category} ${game.description} ${game.controls?.join(' ') || ''}`
      .toLocaleLowerCase('it');
    return searchableText.includes(search)
      && (!filterCategory.value || game.category === filterCategory.value)
      && (!filterInput.value || game.inputs.includes(filterInput.value))
      && (!filterRequirement.value || game.requirements.includes(filterRequirement.value))
      && (!filterFavorites.checked || favorites.has(game.slug));
  });
  renderList(gameList, visibleGames);
  emptyState.hidden = visibleGames.length > 0;
  gameCount.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'gioco disponibile' : 'giochi disponibili'}`;
}

function renderPersonalLists() {
  const favoriteList = games.filter((game) => favorites.has(game.slug));
  const recentList = recent.map((slug) => gameBySlug.get(slug)).filter(Boolean);
  renderList(favoriteGames, favoriteList);
  emptyFavorites.hidden = favoriteList.length > 0;
  recentSection.hidden = recentList.length === 0;
  renderList(recentGames, recentList);
}

function renderNews() {
  const latestGames = games
    .filter(isNew)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  renderList(newGames, latestGames);
  noNews.hidden = latestGames.length > 0;
}

searchGames.addEventListener('input', renderGames);
filterCategory.addEventListener('change', renderGames);
filterInput.addEventListener('change', renderGames);
filterRequirement.addEventListener('change', renderGames);
filterFavorites.addEventListener('change', renderGames);
window.addEventListener('storage', (event) => {
  if (event.key === storageKeys.favorites || event.key === storageKeys.recent || event.key === null) {
    loadSavedState();
    renderGames();
    renderPersonalLists();
  }
});

loadSavedState();
renderNews();
renderPersonalLists();
renderGames();
