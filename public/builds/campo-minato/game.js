const boardElement = document.querySelector('#board');
const message = document.querySelector('#message');
const remainingLabel = document.querySelector('#remaining');
const flagButton = document.querySelector('#flagMode');
const width = 10;
const mineCount = 15;
const cells = [];
let board;
let flags;
let started;
let over;
let flagMode;

function neighbors(index) {
  const row = Math.floor(index / width);
  const column = index % width;
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const y = row + dy;
      const x = column + dx;
      if ((dx || dy) && x >= 0 && x < width && y >= 0 && y < width) result.push(y * width + x);
    }
  }
  return result;
}

function placeMines(safeIndex) {
  const excluded = new Set([safeIndex, ...neighbors(safeIndex)]);
  const candidates = board.map((_, index) => index).filter((index) => !excluded.has(index));
  for (let count = 0; count < mineCount; count += 1) {
    const choice = Math.floor(Math.random() * candidates.length);
    const [index] = candidates.splice(choice, 1);
    board[index].mine = true;
  }
  board.forEach((cell, index) => {
    cell.count = neighbors(index).filter((neighbor) => board[neighbor].mine).length;
  });
  started = true;
}

function render() {
  remainingLabel.textContent = String(mineCount - flags.size);
  board.forEach((cell, index) => {
    const button = cells[index];
    button.className = 'mine-cell';
    button.textContent = '';
    button.disabled = over || (cell.revealed && !cell.mine);
    if (cell.flagged) {
      button.classList.add('flagged');
      button.textContent = '⚑';
      button.setAttribute('aria-label', `Casella ${index + 1}, bandierina`);
    } else if (cell.revealed) {
      button.classList.add('revealed');
      if (cell.mine) {
        button.classList.add('mine-hit');
        button.textContent = '✹';
        button.setAttribute('aria-label', `Casella ${index + 1}, mina`);
      } else {
        button.textContent = cell.count ? String(cell.count) : '';
        button.setAttribute('aria-label', `Casella ${index + 1}${cell.count ? `, ${cell.count} mine vicine` : ', vuota'}`);
      }
    } else {
      button.setAttribute('aria-label', `Casella ${index + 1}, coperta`);
    }
  });
}

function reveal(index) {
  const cell = board[index];
  if (over || cell.flagged || cell.revealed) return;
  if (!started) placeMines(index);
  cell.revealed = true;
  if (cell.mine) {
    over = true;
    board.forEach((entry) => { if (entry.mine) entry.revealed = true; });
    message.textContent = 'Hai trovato una mina. Premi Nuova partita per riprovare.';
  } else {
    if (cell.count === 0) neighbors(index).forEach(reveal);
    if (board.filter((entry) => !entry.mine && entry.revealed).length === width * width - mineCount) {
      over = true;
      message.textContent = 'Campo liberato: hai vinto!';
    }
  }
  render();
}

function toggleFlag(index) {
  const cell = board[index];
  if (over || cell.revealed) return;
  if (cell.flagged) flags.delete(index);
  else if (flags.size < mineCount) flags.add(index);
  cell.flagged = flags.has(index);
  render();
}

function reset() {
  board = Array.from({ length: width * width }, () => ({ mine: false, count: 0, revealed: false, flagged: false }));
  flags = new Set();
  started = false;
  over = false;
  message.textContent = 'Scopri una casella. Il primo tocco è sempre sicuro.';
  render();
}

for (let index = 0; index < width * width; index += 1) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mine-cell';
  button.addEventListener('click', () => flagMode ? toggleFlag(index) : reveal(index));
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    toggleFlag(index);
  });
  cells.push(button);
  boardElement.append(button);
}
flagButton.addEventListener('click', () => {
  flagMode = !flagMode;
  flagButton.setAttribute('aria-pressed', String(flagMode));
  flagButton.textContent = `Modalità bandierina: ${flagMode ? 'sì' : 'no'}`;
});
document.querySelector('#restart').addEventListener('click', reset);
reset();
