const canvas = document.getElementById('railway');
const ctx = canvas.getContext('2d');
const message = document.getElementById('message');
const cashLabel = document.getElementById('cash');
const cargoLabel = document.getElementById('cargo');
const routeLabel = document.getElementById('route');
const sellButton = document.getElementById('sell');
const capacityButton = document.getElementById('capacity');
const speedButton = document.getElementById('speed');
const trackButton = document.getElementById('track');
const saveKey = 'railway-miner-save-v1';

const resourceTypes = [
  { name: 'Carbone', value: 5, color: '#8b9b8d' },
  { name: 'Rame', value: 8, color: '#e29966' },
  { name: 'Argento', value: 12, color: '#c5d4d5' },
  { name: 'Cristallo', value: 20, color: '#78d8cf' },
];

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function loadSave() {
  try {
    const stored = localStorage.getItem(saveKey);
    if (!stored) return { cash: 0, cargo: 0, cargoValue: 0, capacityLevel: 0, speedLevel: 0, trackLevel: 1 };
    const data = JSON.parse(stored);
    return {
      cash: numberInRange(data.cash, 0, 0, 1_000_000_000),
      cargo: numberInRange(data.cargo, 0, 0, 30),
      cargoValue: numberInRange(data.cargoValue, 0, 0, 1_000_000_000),
      capacityLevel: numberInRange(data.capacityLevel, 0, 0, 6),
      speedLevel: numberInRange(data.speedLevel, 0, 0, 5),
      trackLevel: numberInRange(data.trackLevel, 1, 1, 7),
    };
  } catch {
    message.textContent = 'Il salvataggio non è leggibile: è iniziata una nuova ferrovia.';
    return { cash: 0, cargo: 0, cargoValue: 0, capacityLevel: 0, speedLevel: 0, trackLevel: 1 };
  }
}

const state = loadSave();
const mines = Array.from({ length: 16 }, (_, index) => ({
  angle: (Math.PI * 2 * index) / 16 + 0.16,
  type: Math.random() < 0.1 ? 3 : Math.random() < 0.28 ? 2 : Math.random() < 0.55 ? 1 : 0,
  readyAt: 0,
}));

let angle = 0;
let elapsed = 0;
let previousTime = 0;
let lastSave = 0;
let lastUiUpdate = 0;
let saveErrorShown = false;
let messageUntil = 0;

const capacity = () => 8 + state.capacityLevel * 4;
const upgradeCost = (level, base, step) => Math.round(base * (1 + level * step));

function showMessage(text, seconds = 3) {
  message.textContent = text;
  messageUntil = elapsed + seconds;
}

function saveGame() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
    return true;
  } catch {
    if (!saveErrorShown) {
      showMessage('Impossibile salvare: controlla le impostazioni di archiviazione del browser.', 8);
      saveErrorShown = true;
    }
    return false;
  }
}

function sellCargo(automatic = false) {
  if (state.cargo === 0) return;
  const earned = state.cargoValue;
  state.cash += earned;
  state.cargo = 0;
  state.cargoValue = 0;
  showMessage(`${automatic ? 'Vendita automatica in stazione' : 'Carico venduto'}: +${earned} monete.`);
  saveGame();
  updateUi();
}

function buyCapacity() {
  const cost = upgradeCost(state.capacityLevel, 45, 0.8);
  if (state.capacityLevel >= 6 || state.cash < cost) return;
  state.cash -= cost;
  state.capacityLevel += 1;
  showMessage(`Nuovo vagone agganciato: capacità ${capacity()} minerali.`);
  saveGame();
  updateUi();
}

function buySpeed() {
  const cost = upgradeCost(state.speedLevel, 35, 0.9);
  if (state.speedLevel >= 5 || state.cash < cost) return;
  state.cash -= cost;
  state.speedLevel += 1;
  showMessage('Locomotiva migliorata: il giro è più veloce.');
  saveGame();
  updateUi();
}

function buyTrack() {
  const cost = upgradeCost(state.trackLevel - 1, 100, 1.15);
  if (state.trackLevel >= 7 || state.cash < cost) return;
  state.cash -= cost;
  state.trackLevel += 1;
  showMessage(`Nuova tratta aperta: la ferrovia ora è al livello ${state.trackLevel}.`);
  saveGame();
  updateUi();
}

sellButton.addEventListener('click', () => sellCargo());
capacityButton.addEventListener('click', buyCapacity);
speedButton.addEventListener('click', buySpeed);
trackButton.addEventListener('click', buyTrack);
window.addEventListener('keydown', (event) => {
  if (event.repeat || event.target instanceof HTMLButtonElement) return;
  if (event.key === '1') sellCargo();
  if (event.key === '2') buyCapacity();
  if (event.key === '3') buySpeed();
  if (event.key === '4') buyTrack();
});

function updateUi() {
  const capacityCost = upgradeCost(state.capacityLevel, 45, 0.8);
  const speedCost = upgradeCost(state.speedLevel, 35, 0.9);
  const trackCost = upgradeCost(state.trackLevel - 1, 100, 1.15);
  cashLabel.textContent = `${state.cash.toLocaleString('it-IT')} ◈`;
  cargoLabel.textContent = `${state.cargo} / ${capacity()}`;
  routeLabel.textContent = `Tratta ${state.trackLevel}`;
  document.getElementById('sellValue').textContent = state.cargo ? `Valore: ${state.cargoValue} monete` : 'Alla stazione automatica';
  capacityButton.querySelector('span').textContent = state.capacityLevel >= 6 ? 'Massimo raggiunto' : `Costo: ${capacityCost} ◈ · +4 capacità`;
  speedButton.querySelector('span').textContent = state.speedLevel >= 5 ? 'Massimo raggiunto' : `Costo: ${speedCost} ◈ · + velocità`;
  trackButton.querySelector('span').textContent = state.trackLevel >= 7 ? 'Tutte le tratte aperte' : `Costo: ${trackCost} ◈ · nuova tratta`;
  sellButton.disabled = state.cargo === 0;
  capacityButton.disabled = state.capacityLevel >= 6 || state.cash < capacityCost;
  speedButton.disabled = state.speedLevel >= 5 || state.cash < speedCost;
  trackButton.disabled = state.trackLevel >= 7 || state.cash < trackCost;
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawMineral(x, y, color, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, -3);
  ctx.lineTo(7, 9);
  ctx.lineTo(-7, 9);
  ctx.lineTo(-10, -3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#edf3e7';
  ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.restore();
}

function getTrackSize(width, height, level = state.trackLevel) {
  const baseX = Math.min(width * 0.3, 268);
  const baseY = Math.min(height * 0.29, 153);
  return {
    rx: Math.min(width * 0.44, baseX + (level - 1) * 17),
    ry: Math.min(height * 0.43, baseY + (level - 1) * 10),
  };
}

function drawTrain(width, height, rx, ry) {
  const cx = width / 2;
  const cy = height / 2 + 6;
  const tangent = Math.atan2(ry * Math.cos(angle), -rx * Math.sin(angle));
  const wagonCount = Math.min(1 + state.capacityLevel, 5);

  for (let index = wagonCount; index >= 0; index -= 1) {
    const wagonAngle = angle - index * 0.12;
    const x = cx + rx * Math.cos(wagonAngle);
    const y = cy + ry * Math.sin(wagonAngle);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tangent);
    if (index === 0) {
      roundedRect(-16, -11, 30, 22, 6);
      ctx.fillStyle = '#8bc77d';
      ctx.fill();
      roundedRect(-3, -18, 13, 11, 3);
      ctx.fillStyle = '#519a70';
      ctx.fill();
      ctx.fillStyle = '#c9e5dd';
      ctx.fillRect(0, -16, 7, 6);
      ctx.fillStyle = '#f2c276';
      ctx.fillRect(11, -4, 5, 8);
    } else {
      roundedRect(-13, -8, 26, 16, 4);
      ctx.fillStyle = '#b58d5d';
      ctx.fill();
      ctx.fillStyle = '#e4c28e';
      ctx.fillRect(-8, -5, 16, 3);
    }
    ctx.fillStyle = '#27342b';
    ctx.beginPath();
    ctx.arc(-8, 9, 4, 0, Math.PI * 2);
    ctx.arc(9, 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1c2b20');
  gradient.addColorStop(1, '#17221d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(197, 219, 178, .12)';
  for (let x = 18; x < width; x += 28) {
    for (let y = 18; y < height; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const cx = width / 2;
  const cy = height / 2 + 6;
  for (let level = 1; level <= state.trackLevel; level += 1) {
    const { rx, ry } = getTrackSize(width, height, level);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#465444';
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#d1a96c';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const { rx, ry } = getTrackSize(width, height);
  ctx.fillStyle = '#354b38';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fc58b';
  ctx.font = `700 ${Math.max(11, width * 0.022)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('MINIERA', cx, cy - 2);
  ctx.fillStyle = '#b5c8a9';
  ctx.font = `${Math.max(9, width * 0.015)}px system-ui`;
  ctx.fillText(`${state.trackLevel} ${state.trackLevel === 1 ? 'tratta aperta' : 'tratte aperte'}`, cx, cy + 15);

  const stationX = cx + rx;
  const stationY = cy;
  ctx.fillStyle = '#f2c276';
  ctx.beginPath();
  ctx.arc(stationX, stationY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#36452f';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', stationX, stationY + 1);
  ctx.textBaseline = 'alphabetic';

  for (const mineral of mines) {
    if (mineral.readyAt > elapsed) continue;
    const x = cx + rx * Math.cos(mineral.angle);
    const y = cy + ry * Math.sin(mineral.angle);
    const outwardX = Math.cos(mineral.angle) * 25;
    const outwardY = Math.sin(mineral.angle) * 25;
    drawMineral(x + outwardX, y + outwardY, resourceTypes[mineral.type].color, 0.85);
  }

  drawTrain(width, height, rx, ry);
  ctx.fillStyle = '#e1ead9';
  ctx.font = `600 ${Math.max(10, width * 0.018)}px system-ui`;
  ctx.textAlign = 'left';
  ctx.fillText('STAZIONE', Math.max(10, stationX - 68), stationY - 20);
}

function normalizedAngle(value) {
  return (value % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
}

function mineNearby() {
  const maxCargo = capacity();
  if (state.cargo >= maxCargo) return;
  for (const mineral of mines) {
    if (mineral.readyAt > elapsed) continue;
    const distance = Math.atan2(Math.sin(mineral.angle - angle), Math.cos(mineral.angle - angle));
    if (Math.abs(distance) > 0.13) continue;
    const mined = resourceTypes[mineral.type];
    state.cargo += 1;
    state.cargoValue += mined.value;
    mineral.readyAt = elapsed + 7 + Math.random() * 4;
    if (state.cargo === maxCargo) showMessage('Vagoni pieni! La stazione venderà il carico al prossimo passaggio.');
    else showMessage(`Raccolto ${mined.name.toLowerCase()} · ${state.cargo}/${maxCargo} posti.`);
    break;
  }
}

function update(time) {
  if (!previousTime) previousTime = time;
  const delta = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  elapsed += delta;

  const oldAngle = normalizedAngle(angle);
  angle += delta * (0.52 + state.speedLevel * 0.15);
  const newAngle = normalizedAngle(angle);
  mineNearby();
  if (newAngle < oldAngle && state.cargo > 0) sellCargo(true);

  if (time - lastUiUpdate > 200) {
    updateUi();
    lastUiUpdate = time;
  }
  if (elapsed - lastSave > 5) {
    saveGame();
    lastSave = elapsed;
  }
  if (messageUntil && elapsed > messageUntil) {
    message.textContent = 'Il trenino continua a scavare: migliora la ferrovia per aumentare produzione e capacità.';
    messageUntil = 0;
  }
  draw();
  requestAnimationFrame(update);
}

window.addEventListener('beforeunload', saveGame);
updateUi();
requestAnimationFrame(update);
