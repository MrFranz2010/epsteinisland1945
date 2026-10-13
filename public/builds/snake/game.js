const canvas = document.querySelector('#board');
const context = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score');
const message = document.querySelector('#message');
const size = 20;
let snake;
let direction;
let nextDirection;
let apple;
let score;
let timer;
let running;
let won;

function placeApple() {
  do {
    apple = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
  } while (snake.some((part) => part.x === apple.x && part.y === apple.y));
}

function draw() {
  const cell = canvas.width / size;
  context.fillStyle = '#0e1513';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e9775e';
  context.beginPath();
  context.arc((apple.x + .5) * cell, (apple.y + .5) * cell, cell * .34, 0, Math.PI * 2);
  context.fill();
  snake.forEach((part, index) => {
    context.fillStyle = index === 0 ? '#d4f1aa' : '#a8d86e';
    context.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
  });
  if (!running) {
    context.fillStyle = 'rgba(8, 11, 16, .72)';
    context.fillRect(0, canvas.height / 2 - 26, canvas.width, 52);
    context.fillStyle = '#f4f7fb';
    context.font = 'bold 19px sans-serif';
    context.textAlign = 'center';
    context.fillText(won ? 'Hai vinto! · premi R' : score ? 'Partita terminata · premi R' : 'Scegli una direzione per iniziare', canvas.width / 2, canvas.height / 2 + 7);
  }
}

function reset() {
  clearInterval(timer);
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  running = false;
  won = false;
  scoreLabel.textContent = '0';
  message.textContent = 'Premi una freccia o tocca un pulsante per iniziare.';
  placeApple();
  draw();
}

function setDirection(name) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const requested = directions[name];
  if (!requested || (requested.x === -direction.x && requested.y === -direction.y)) return;
  nextDirection = requested;
  if (!running) {
    running = true;
    message.textContent = 'In partita · raccogli le mele!';
    timer = setInterval(tick, 115);
  }
}

function tick() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const eatsApple = head.x === apple.x && head.y === apple.y;
  const body = eatsApple ? snake : snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= size || head.y >= size || body.some((part) => part.x === head.x && part.y === head.y)) {
    running = false;
    clearInterval(timer);
    message.textContent = `Partita terminata · punteggio: ${score}. Premi R per riprovare.`;
    draw();
    return;
  }
  snake.unshift(head);
  if (eatsApple) {
    score += 1;
    scoreLabel.textContent = String(score);
    if (snake.length === size * size) {
      running = false;
      won = true;
      clearInterval(timer);
      message.textContent = 'Hai riempito il campo: vittoria!';
    } else {
      placeApple();
    }
  } else {
    snake.pop();
  }
  draw();
}

document.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  if (event.key.toLowerCase() === 'r') reset();
  if (keys[event.key] || keys[event.key.toLowerCase()]) {
    event.preventDefault();
    setDirection(keys[event.key] || keys[event.key.toLowerCase()]);
  }
});
document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
document.querySelector('#restart').addEventListener('click', reset);
reset();
