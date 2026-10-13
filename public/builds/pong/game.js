const canvas = document.querySelector('#board');
const context = canvas.getContext('2d');
const playerLabel = document.querySelector('#playerScore');
const cpuLabel = document.querySelector('#cpuScore');
const message = document.querySelector('#message');
const paddleHeight = 90;
let playerY;
let cpuY;
let ball;
let playerScore;
let cpuScore;
let running;
let finished;
let up = false;
let down = false;
let frame;

function resetBall(direction = 1) {
  ball = { x: canvas.width / 2, y: canvas.height / 2, vx: direction * 5, vy: (Math.random() - .5) * 5 };
}

function draw() {
  context.fillStyle = '#0e1513';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setLineDash([10, 12]);
  context.strokeStyle = '#425142';
  context.beginPath();
  context.moveTo(canvas.width / 2, 0);
  context.lineTo(canvas.width / 2, canvas.height);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#a8d86e';
  context.fillRect(25, playerY, 12, paddleHeight);
  context.fillRect(canvas.width - 37, cpuY, 12, paddleHeight);
  context.beginPath();
  context.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#d3e7bd';
  context.font = 'bold 38px sans-serif';
  context.textAlign = 'center';
  context.fillText(`${playerScore}     ${cpuScore}`, canvas.width / 2, 55);
  if (!running) {
    context.fillStyle = 'rgba(8, 11, 16, .72)';
    context.fillRect(0, canvas.height / 2 - 35, canvas.width, 70);
    context.fillStyle = '#f4f7fb';
    context.font = 'bold 23px sans-serif';
    context.fillText(finished ? 'Partita conclusa · ricomincia' : 'Pronti? Premi Spazio per servire', canvas.width / 2, canvas.height / 2 + 8);
  }
}

function update() {
  if (!running) return;
  if (up) playerY -= 7;
  if (down) playerY += 7;
  playerY = Math.max(0, Math.min(canvas.height - paddleHeight, playerY));
  const cpuTarget = ball.y - paddleHeight / 2;
  cpuY += Math.max(-4.6, Math.min(4.6, cpuTarget - cpuY));
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.y < 10 || ball.y > canvas.height - 10) ball.vy *= -1;
  if (ball.vx < 0 && ball.x < 45 && ball.y > playerY && ball.y < playerY + paddleHeight) {
    ball.vx = Math.min(8, Math.abs(ball.vx) + .3);
    ball.vy = ((ball.y - playerY) / paddleHeight - .5) * 9;
  }
  if (ball.vx > 0 && ball.x > canvas.width - 45 && ball.y > cpuY && ball.y < cpuY + paddleHeight) {
    ball.vx = -Math.min(8, Math.abs(ball.vx) + .3);
    ball.vy = ((ball.y - cpuY) / paddleHeight - .5) * 9;
  }
  if (ball.x < 0 || ball.x > canvas.width) {
    if (ball.x < 0) cpuScore += 1;
    else playerScore += 1;
    playerLabel.textContent = String(playerScore);
    cpuLabel.textContent = String(cpuScore);
    if (playerScore >= 5 || cpuScore >= 5) {
      running = false;
      finished = true;
      message.textContent = playerScore >= 5 ? 'Hai vinto! Premi Spazio per ricominciare.' : 'Vince il computer. Premi Spazio per riprovare.';
    } else {
      running = false;
      resetBall(playerScore > cpuScore ? 1 : -1);
      message.textContent = 'Punto! Premi Spazio per il prossimo servizio.';
    }
  }
  draw();
  frame = requestAnimationFrame(update);
}

function start() {
  if (running) return;
  if (finished) {
    playerScore = 0;
    cpuScore = 0;
    playerLabel.textContent = '0';
    cpuLabel.textContent = '0';
    finished = false;
    resetBall();
  }
  running = true;
  message.textContent = 'Muovi la racchetta e respingi la pallina.';
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
}

function reset() {
  cancelAnimationFrame(frame);
  playerY = cpuY = (canvas.height - paddleHeight) / 2;
  playerScore = cpuScore = 0;
  playerLabel.textContent = cpuLabel.textContent = '0';
  running = finished = false;
  resetBall();
  message.textContent = 'Premi Spazio o tocca il campo per iniziare.';
  draw();
}

document.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') up = true;
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') down = true;
  if (event.key === ' ') start();
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') up = false;
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') down = false;
});
canvas.addEventListener('pointermove', (event) => {
  if (event.buttons) playerY = Math.max(0, Math.min(canvas.height - paddleHeight, event.offsetY / canvas.clientHeight * canvas.height - paddleHeight / 2));
});
canvas.addEventListener('pointerdown', start);
document.querySelector('#restart').addEventListener('click', reset);
reset();
