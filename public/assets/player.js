import { games, gamePage, siteRoot, siteUrl } from './games.js';
import { setupFullscreen } from './fullscreen.js';

const game = games.find((entry) => entry.slug === document.body.dataset.game);
const gameShell = document.getElementById('gameShell');
const gameFrame = document.getElementById('gameFrame');
const placeholder = document.getElementById('placeholder');
const playBtn = document.getElementById('playBtn');
const reloadBtn = document.getElementById('reloadBtn');
const gameStatus = document.getElementById('gameStatus');
const loadNotice = document.getElementById('loadNotice');
let loadTimeout;
let loading = false;

function showError(message) {
  loading = false;
  clearTimeout(loadTimeout);
  gameFrame.hidden = true;
  placeholder.hidden = false;
  document.getElementById('stageTitle').textContent = 'Il gioco non si apre';
  document.getElementById('stageDescription').textContent = message;
  playBtn.textContent = 'Riprova';
  playBtn.disabled = false;
  reloadBtn.disabled = true;
  gameStatus.textContent = 'Caricamento non riuscito';
  gameShell.removeAttribute('aria-busy');
}

async function startGame() {
  if (loading || !game) return;
  loading = true;
  playBtn.disabled = true;
  reloadBtn.disabled = true;
  placeholder.hidden = false;
  gameFrame.hidden = true;
  loadNotice.hidden = true;
  gameStatus.textContent = 'Caricamento in corso…';
  document.getElementById('stageTitle').textContent = 'Preparazione del gioco…';
  document.getElementById('stageDescription').textContent = 'Caricamento della build ospitata su Racing Zone.';
  gameShell.setAttribute('aria-busy', 'true');
  clearTimeout(loadTimeout);
  loadTimeout = setTimeout(() => {
    showError('Il caricamento sta impiegando troppo tempo. Controlla la connessione e riprova.');
    gameFrame.removeAttribute('src');
  }, 45000);
  try {
    const entryUrl = new URL(siteUrl(game.entry));
    const buildsPath = new URL('builds/', siteRoot).pathname;
    if (entryUrl.origin !== location.origin || !entryUrl.pathname.startsWith(buildsPath)) {
      throw new Error('Invalid game entry');
    }
    const response = await fetch(entryUrl, { method: 'HEAD' });
    if (!loading) return;
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Missing game build');
    }
    gameFrame.src = entryUrl.href;
  } catch {
    if (loading) showError('La build non è disponibile. Verifica i file del gioco oppure riprova tra poco.');
  }
}

gameFrame.addEventListener('load', () => {
  if (!loading || !gameFrame.hasAttribute('src')) return;
  clearTimeout(loadTimeout);
  loading = false;
  gameFrame.hidden = false;
  placeholder.hidden = true;
  reloadBtn.disabled = false;
  playBtn.disabled = false;
  gameShell.removeAttribute('aria-busy');
  gameStatus.textContent = 'Gioco aperto · Clicca nell’area per giocare';
  loadNotice.textContent = 'La build può impiegare qualche secondo a inizializzarsi. Se resta vuota, ricarica il gioco e verifica che il browser supporti WebGL.';
  loadNotice.hidden = false;
  gameFrame.focus();
});
gameFrame.addEventListener('error', () => showError('Impossibile caricare il gioco. Controlla la connessione e riprova.'));
playBtn.addEventListener('click', startGame);
reloadBtn.addEventListener('click', startGame);
setupFullscreen(gameShell);

if (game) {
  document.title = `${game.title} — Racing Zone`;
  document.querySelector('meta[name="description"]').content = game.description;
  document.getElementById('gameTitle').textContent = game.title.toUpperCase();
  const accent = document.createElement('span');
  accent.className = 'accent';
  accent.textContent = '.';
  document.getElementById('gameTitle').append(accent);
  document.getElementById('gameCategory').textContent = game.category + (game.version ? ` · Versione ${game.version}` : '');
  const gameDescription = document.getElementById('gameDescription');
  if (gameDescription) gameDescription.textContent = game.description;
  gameShell.setAttribute('aria-label', `Area di gioco ${game.title}`);
  gameFrame.title = game.title;
  for (const control of game.controls || []) {
    const item = document.createElement('li');
    item.textContent = control;
    document.getElementById('gameControls')?.append(item);
  }
  const gameNotes = document.getElementById('gameNotes');
  if (gameNotes) gameNotes.textContent = game.notes || 'Clicca nell’area di gioco per attivare i comandi.';
  const credits = document.getElementById('gameCredits');
  credits.textContent = game.credits || '';
  if (game.authorUrl) {
    const authorUrl = new URL(game.authorUrl);
    if (authorUrl.protocol === 'https:') {
      const author = document.createElement('a');
      author.href = authorUrl.href;
      author.target = '_blank';
      author.rel = 'noopener noreferrer';
      author.textContent = ' Sito dell’autore ↗';
      credits.append(author);
    }
  }
  for (const otherGame of games.filter((entry) => entry.slug !== game.slug)) {
    const link = document.createElement('a');
    link.href = gamePage(otherGame);
    link.className = 'button-link';
    link.textContent = `${otherGame.title} →`;
    document.getElementById('relatedGames').append(link);
  }
} else {
  showError('Questo gioco non è configurato. Torna al catalogo per scegliere un gioco disponibile.');
  playBtn.hidden = true;
}
