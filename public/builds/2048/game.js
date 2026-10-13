const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const message = document.querySelector('#message');
const cells = [];
let board;
let score;
let won;
let touchStart;

for (let index = 0; index < 16; index += 1) {
  const cell = document.createElement('div');
  cell.className = 'tile';
  cell.setAttribute('role', 'gridcell');
  cells.push(cell);
  boardElement.append(cell);
}

function addTile() {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return;
  const index = empty[Math.floor(Math.random() * empty.length)];
  board[index] = Math.random() < .9 ? 2 : 4;
}

function draw() {
  board.forEach((value, index) => {
    cells[index].textContent = value || '';
    cells[index].dataset.value = String(value);
    cells[index].setAttribute('aria-label', value ? String(value) : 'Vuota');
  });
  scoreElement.textContent = String(score);
}

function reset() {
  board = Array(16).fill(0);
  score = 0;
  won = false;
  addTile();
  addTile();
  message.textContent = 'Usa le frecce, WASD o scorri sul tabellone.';
  draw();
}

function canMove() {
  return board.some((value, index) => {
    if (!value) return false;
    const row = Math.floor(index / 4);
    const column = index % 4;
    return (column < 3 && board[index + 1] === value) || (row < 3 && board[index + 4] === value);
  });
}

function move(direction) {
  if (message.dataset.over === 'true') return;
  const original = [...board];
  const lines = [];
  for (let line = 0; line < 4; line += 1) {
    const indices = Array.from({ length: 4 }, (_, position) => direction === 'left' || direction === 'right'
      ? line * 4 + (direction === 'left' ? position : 3 - position)
      : (direction === 'up' ? position : 3 - position) * 4 + line);
    lines.push(indices);
  }
  for (const indices of lines) {
    const values = indices.map((index) => board[index]).filter(Boolean);
    const merged = [];
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === values[index + 1]) {
        merged.push(values[index] * 2);
        score += values[index] * 2;
        index += 1;
      } else {
        merged.push(values[index]);
      }
    }
    indices.forEach((index, position) => { board[index] = merged[position] || 0; });
  }
  if (board.every((value, index) => value === original[index])) return;
  addTile();
  draw();
  if (!won && board.includes(2048)) {
    won = true;
    message.textContent = 'Hai raggiunto 2048! Puoi continuare a giocare.';
  } else if (board.every(Boolean) && !canMove()) {
    message.textContent = 'Nessuna mossa disponibile. Premi Nuova partita per riprovare.';
    message.dataset.over = 'true';
  } else if (message.dataset.over === 'true') {
    message.dataset.over = 'false';
  }
}

document.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  const direction = keys[event.key] || keys[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    move(direction);
  }
});
boardElement.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
boardElement.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStart.x;
  const deltaY = touch.clientY - touchStart.y;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 24) {
    move(Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? 'right' : 'left') : (deltaY > 0 ? 'down' : 'up'));
  }
  touchStart = null;
}, { passive: true });
document.querySelector('#restart').addEventListener('click', () => {
  delete message.dataset.over;
  reset();
});
reset();
