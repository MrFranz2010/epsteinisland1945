const canvas = document.querySelector('#board');
const context = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score');
const livesLabel = document.querySelector('#lives');
const message = document.querySelector('#message');
const colors = ['#a8d86e', '#f4c46b', '#e9775e', '#8bb8ee', '#cf9be8'];
let paddle;
let ball;
let bricks;
let score;
let lives;
let running;
let ended;
let frame;
let left = false;
let right = false;

function makeBricks() {
  return Array.from({ length: 5 }, (_, row) => Array.from({ length: 10 }, (_, column) => ({
    x: 36 + column * 73,
    y: 50 + row * 29,
    visible: true,
    color: colors[row],
  })));
}

function draw() {
  context.fillStyle = '#0e1513';
  context.fillRect(0, 0, canvas.width, canvas.height);
  bricks.flat().filter((brick) => brick.visible).forEach((brick) => {
    context.fillStyle = brick.color;
    context.fillRect(brick.x, brick.y, 65, 19);
  });
  context.fillStyle = '#d3e7bd';
  context.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  context.beginPath();
  context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  context.fill();
  if (!running) {
    context.fillStyle = 'rgba(8, 11, 16, .72)';
    context.fillRect(0, canvas.height / 2 - 35, canvas.width, 70);
    context.fillStyle = '#f4f7fb';
    context.font = 'bold 23px sans-serif';
    context.textAlign = 'center';
    context.fillText(ended ? 'Partita conclusa · ricomincia' : 'Pronti? Premi Spazio per iniziare', canvas.width / 2, canvas.height / 2 + 8);
  }
}

function resetBall() {
  ball = { x: canvas.width / 2, y: paddle.y - 12, vx: 4, vy: -4, radius: 8 };
}

function reset() {
  cancelAnimationFrame(frame);
  paddle = { x: (canvas.width - 120) / 2, y: canvas.height - 32, width: 120, height: 12 };
  bricks = makeBricks();
  score = 0;
  lives = 3;
  running = ended = false;
  left = right = false;
  scoreLabel.textContent = '0';
  livesLabel.textContent = '3';
  message.textContent = 'Premi Spazio o tocca il campo per iniziare.';
  resetBall();
  draw();
}

function update() {
  if (!running) return;
  if (left) paddle.x -= 7;
  if (right) paddle.x += 7;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) ball.vx *= -1;
  if (ball.y < ball.radius) ball.vy = Math.abs(ball.vy);
  if (ball.vy > 0 && ball.y + ball.radius >= paddle.y && ball.y < paddle.y + paddle.height && ball.x >= paddle.x && ball.x <= paddle.x + paddle.width) {
    const offset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    ball.vx = offset * 6;
    ball.vy = -Math.max(3, Math.sqrt(49 - ball.vx * ball.vx));
  }
  for (const brick of bricks.flat()) {
    if (brick.visible && ball.x + ball.radius >= brick.x && ball.x - ball.radius <= brick.x + 65 && ball.y + ball.radius >= brick.y && ball.y - ball.radius <= brick.y + 19) {
      brick.visible = false;
      ball.vy *= -1;
      score += 10;
      scoreLabel.textContent = String(score);
      break;
    }
  }
  if (bricks.flat().every((brick) => !brick.visible)) {
    running = false;
    ended = true;
    message.textContent = 'Hai demolito tutti i mattoni: vittoria!';
  } else if (ball.y > canvas.height) {
    lives -= 1;
    livesLabel.textContent = String(lives);
    if (!lives) {
      running = false;
      ended = true;
      message.textContent = `Partita terminata · ${score} punti. Premi Spazio per ricominciare.`;
    } else {
      running = false;
      resetBall();
      message.textContent = 'Hai perso una vita. Premi Spazio per continuare.';
    }
  }
  draw();
  frame = requestAnimationFrame(update);
}

function start() {
  if (running) return;
  if (ended) reset();
  running = true;
  message.textContent = 'Distruggi tutti i mattoni!';
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
}

document.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') left = true;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') right = true;
  if (event.key === ' ') start();
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') left = false;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') right = false;
});
canvas.addEventListener('pointermove', (event) => {
  if (event.buttons) paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, event.offsetX / canvas.clientWidth * canvas.width - paddle.width / 2));
});
canvas.addEventListener('pointerdown', start);
document.querySelector('#restart').addEventListener('click', reset);
reset();
