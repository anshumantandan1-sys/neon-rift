import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const ui = new UI();
const audio = new AudioEngine();
const canvas = document.getElementById('game-canvas');

let game = null;
let joined = false;
let leaving = false;
let hasLockedOnce = false;
let pendingJoin = null;
let joinTimer = null;
let socket = null;

const STORAGE = {
  name: 'neonrift.name',
  sens: 'neonrift.sensitivity',
  muted: 'neonrift.muted',
  quality: 'neonrift.quality',
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function randomCallsign() {
  const words = ['NOVA', 'VOLT', 'GLITCH', 'PIXEL', 'ORBIT', 'QUASAR', 'ZAP', 'RIPTIDE'];
  return `${words[Math.floor(Math.random() * words.length)]}${Math.floor(10 + Math.random() * 90)}`;
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/[^\w \-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

// ---------------------------------------------------------------- setup
try {
  game = new Game(canvas, ui, audio);
} catch (err) {
  console.error('[neon-rift] renderer failed', err);
  ui.setBoot('WEBGL UNAVAILABLE — THIS GAME NEEDS HARDWARE ACCELERATION');
  const quick = document.getElementById('quickplay-btn');
  if (quick) {
    quick.disabled = true;
    quick.textContent = 'WEBGL REQUIRED';
  }
}

if (game) {
  game.onMove = (data) => socket?.emit('move', data);
  game.onShoot = (data) => socket?.emit('shoot', data);
  game.onWeaponChange = (weapon) => socket?.emit('weapon', { weapon });

  game.onLockChange = (locked) => {
    if (locked) {
      hasLockedOnce = true;
      ui.setLockHint(false);
      if (game.paused) {
        game.setPaused(false);
        ui.showPause(false);
      }
      return;
    }
    ui.setLockHint(game.mode === 'playing' && !game.paused);
    if (
      hasLockedOnce &&
      game.mode === 'playing' &&
      !game.paused &&
      !leaving &&
      joined
    ) {
      game.setPaused(true);
      ui.showPause(true);
      ui.showScoreboard(false);
    }
  };

  // Settings
  const savedQuality = safeGet(STORAGE.quality) || 'high';
  game.setQuality(savedQuality === 'lite' ? 'lite' : 'high');
  ui.setQuality(savedQuality === 'lite' ? 'lite' : 'high');

  const savedSens = Number(safeGet(STORAGE.sens)) || 1;
  game.input.sensitivity = savedSens;
  if (game.local) game.local.sensitivity = savedSens;
  ui.setSensitivity(savedSens);

  const savedMute = safeGet(STORAGE.muted) === '1';
  audio.setMuted(savedMute);
  ui.setMuted(savedMute);

  const nameInput = document.getElementById('name-input');
  if (nameInput) nameInput.value = safeGet(STORAGE.name) || randomCallsign();

  setTimeout(() => ui.hideBoot(), 450);
  ui.showMenu();
} else {
  setTimeout(() => ui.hideBoot(), 900);
}

// ---------------------------------------------------------------- socket
if (typeof io === 'function') {
  socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000,
    timeout: 12000,
  });
  wireSocket(socket);
} else {
  ui.setMenuError('Socket.IO client failed to load. Check your connection.');
}

function wireSocket(sock) {
  sock.on('connect', () => {
    if (pendingJoin) {
      sock.emit('join', pendingJoin);
      pendingJoin = null;
    }
  });

  sock.on('connect_error', () => {
    if (!joined) {
      ui.setMenuError('Cannot reach the arena server. Retrying…');
      ui.setMenuBusy(false);
    }
  });

  sock.on('joined', (data) => {
    clearTimeout(joinTimer);
    joined = true;
    leaving = false;
    pendingJoin = null;
    hasLockedOnce = false;
    ui.setMenuError('');
    ui.setMenuBusy(false);
    audio.init();
    audio.startMusic();
    safeSet(STORAGE.name, data.name);
    game?.startSession(data);
    ui.hideBoot();
    ui.notice(`Welcome, ${data.name}`, 'streak');
  });

  sock.on('snapshot', (snap) => {
    game?.applySnapshot(snap);
  });

  sock.on('shot', (data) => game?.onRemoteShot(data));
  sock.on('hit', (data) => game?.onHit(data));
  sock.on('kill', (data) => game?.onKill(data));
  sock.on('death', (data) => game?.onSelfDeath(data));
  sock.on('respawn', (data) => game?.onRespawn(data));
  sock.on('matchEnd', (data) => game?.onMatchEnd(data));
  sock.on('matchStart', () => game?.onMatchStart());

  sock.on('playerJoined', (data) => {
    if (data?.name) ui.notice(`${data.name} joined the rift`);
  });

  sock.on('playerLeft', (data) => {
    if (data?.name) ui.notice(`${data.name} left the arena`);
  });

  sock.on('notice', (data) => {
    if (data?.text) ui.notice(data.text, data.kind || '');
  });

  sock.on('errorMsg', (data) => {
    clearTimeout(joinTimer);
    const message = data?.message || 'Something went wrong.';
    if (!joined) {
      ui.setMenuError(message);
      ui.setMenuBusy(false);
      pendingJoin = null;
    } else {
      ui.notice(message);
    }
  });

  sock.on('disconnect', () => {
    if (leaving || !joined) return;
    joined = false;
    game?.setDisconnected(true);
    game?.input.unlock();
    ui.signalLost(true);
    ui.setLockHint(false);
  });
}

// ---------------------------------------------------------------- join flow
function requestJoin(room, buttonEl) {
  if (!game || !socket) return;
  const nameInput = document.getElementById('name-input');
  const name = cleanName(nameInput?.value) || randomCallsign();
  if (nameInput) nameInput.value = name;
  audio.init();
  ui.setMenuError('');
  ui.setMenuBusy(true, 'LINKING…');
  if (buttonEl) buttonEl.blur();

  const payload = { name, room: room || 'AUTO' };
  pendingJoin = payload;
  joined = false;

  if (socket.connected) {
    socket.emit('join', payload);
    pendingJoin = null;
  } else {
    socket.connect();
  }

  clearTimeout(joinTimer);
  joinTimer = setTimeout(() => {
    if (!joined) {
      ui.setMenuError('The arena is not responding. Please try again.');
      ui.setMenuBusy(false);
      pendingJoin = null;
    }
  }, 9000);
}

function leaveMatch() {
  if (!game) return;
  leaving = true;
  joined = false;
  pendingJoin = null;
  game.input.unlock();
  socket?.emit('leave');
  socket?.disconnect();
  game.resetToMenu();
  ui.setMenuBusy(false);
  ui.showMenu();
  audio.init();
}

// ---------------------------------------------------------------- UI events
const quickBtn = document.getElementById('quickplay-btn');
const joinBtn = document.getElementById('join-room-btn');
const roomInput = document.getElementById('room-input');
const nameInput = document.getElementById('name-input');

quickBtn?.addEventListener('click', () => requestJoin('AUTO', quickBtn));
joinBtn?.addEventListener('click', () => {
  const code = (roomInput?.value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
  if (code.length < 2) {
    ui.setMenuError('Enter a room code (2–10 letters or numbers) to join.');
    roomInput?.focus();
    return;
  }
  requestJoin(code, joinBtn);
});

for (const input of [nameInput, roomInput]) {
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (roomInput) roomInput.value = roomInput.value.toUpperCase();
      if (input === roomInput && roomInput.value.trim()) joinBtn?.click();
      else quickBtn?.click();
    }
    if (e.key === 'Escape') input.blur();
  });
}

roomInput?.addEventListener('input', () => {
  roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
});

canvas.addEventListener('click', () => {
  audio.init();
  if (!game) return;
  if (game.mode === 'playing' && !game.paused && joined && !game.input.locked) {
    game.input.lock();
  }
});

document.getElementById('resume-btn')?.addEventListener('click', () => {
  if (!game) return;
  audio.playUiClick();
  game.setPaused(false);
  ui.showPause(false);
  game.input.lock();
  setTimeout(() => {
    if (game && !game.input.locked && game.mode === 'playing') ui.setLockHint(true);
  }, 400);
});

document.getElementById('leave-btn')?.addEventListener('click', () => {
  audio.playUiClick();
  leaveMatch();
});

document.getElementById('results-leave-btn')?.addEventListener('click', () => {
  audio.playUiClick();
  leaveMatch();
});

document.getElementById('reload-btn')?.addEventListener('click', () => window.location.reload());

document.getElementById('room-chip')?.addEventListener('click', async () => {
  const code = game?.roomCode;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    ui.notice(`Room code ${code} copied`);
  } catch {
    ui.notice(`Room code: ${code}`);
  }
});

function toggleSound() {
  audio.init();
  const next = !audio.muted;
  audio.setMuted(next);
  ui.setMuted(next);
  safeSet(STORAGE.muted, next ? '1' : '0');
  if (!next) audio.playUiClick();
}

document.getElementById('sound-toggle')?.addEventListener('click', toggleSound);
document.getElementById('sound-toggle-pause')?.addEventListener('click', toggleSound);

const sensitivity = document.getElementById('sensitivity');
sensitivity?.addEventListener('input', () => {
  const value = Number(sensitivity.value) || 1;
  if (game) {
    game.input.sensitivity = value;
    game.local.sensitivity = value;
  }
  ui.setSensitivity(value);
  safeSet(STORAGE.sens, String(value));
});

for (const btn of document.querySelectorAll('#quality-toggle button')) {
  btn.addEventListener('click', () => {
    const quality = btn.dataset.quality === 'lite' ? 'lite' : 'high';
    game?.setQuality(quality);
    ui.setQuality(quality);
    safeSet(STORAGE.quality, quality);
    audio.playUiClick();
  });
}

document.addEventListener('mouseover', (e) => {
  const btn = e.target.closest?.('.btn');
  if (btn && !btn.disabled && btn !== document._lastHover) {
    document._lastHover = btn;
    audio.playUiHover();
  }
});

window.addEventListener('beforeunload', () => {
  try {
    socket?.emit('leave');
  } catch {
    /* ignore */
  }
});

// Credit hint if the player joins with an empty code.
if (roomInput) roomInput.placeholder = 'NR-XXXX';

// Expose for quick debugging in the browser console.
window.NEON_RIFT = { get game() { return game; }, get socket() { return socket; }, ui, audio };
