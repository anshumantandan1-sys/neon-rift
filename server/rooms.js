import {
  EYE_HEIGHT,
  PLAYER_RADIUS,
  SPAWNS,
  rayHitsArena,
  rayHitsPlayer,
  resolveCollision,
} from '../public/js/arena.js';
import {
  BOT_DAMAGE_SCALE,
  BOT_FILL_TOTAL,
  BOT_NAMES,
  HEALTH_REGEN_DELAY_MS,
  HEALTH_REGEN_PER_SEC,
  MATCH_DURATION_MS,
  MATCH_RESTART_MS,
  MAX_PLAYERS,
  MAX_ROOMS,
  PLAYER_MAX_HEALTH,
  POSITION_TOLERANCE,
  RESPAWN_TIME_MS,
  ROOM_LINGER_MS,
  SNAPSHOT_HZ,
  SPAWN_PROTECTION_MS,
  SPRINT_SPEED,
  TICK_HZ,
  WEAPONS,
  WEAPON_IDS,
} from './config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function normalizeDir(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  const len = Math.hypot(x, y, z);
  if (len < 1e-4 || len > 10) return null;
  return { x: x / len, y: y / len, z: z / len };
}

function spreadDirection(dir, spread) {
  const jitter = () => (Math.random() * 2 - 1) * spread;
  const x = dir.x + jitter();
  const y = dir.y + jitter();
  const z = dir.z + jitter();
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name.length >= 1 ? name : null;
}

function sanitizeRoomCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);
  return code.length >= 2 ? code : null;
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `NR-${out}`;
}

function makePlayer({ id, name, socketId = null, isBot = false }) {
  return {
    id,
    name,
    socketId,
    isBot,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    health: PLAYER_MAX_HEALTH,
    alive: false,
    kills: 0,
    deaths: 0,
    streak: 0,
    bestStreak: 0,
    weapon: 'rifle',
    lastShot: 0,
    lastDamage: 0,
    invulnUntil: 0,
    lastMoveAt: 0,
    lastAttackerId: null,
    respawnAt: 0,
    joinedAt: Date.now(),
    botNextThink: 0,
    botNextShot: 0,
    botBurst: 3,
    botTargetId: null,
    botSeed: Math.random() * 1000,
    botWaypoint: null,
    botStuckAt: 0,
    botLastPos: { x: 0, z: 0 },
  };
}

export class Room {
  constructor(code, io) {
    this.code = code;
    this.io = io;
    this.players = new Map();
    this.createdAt = Date.now();
    this.lastHumanAt = Date.now();
    this.state = 'playing';
    this.matchEndsAt = Date.now() + MATCH_DURATION_MS;
    this.restartAt = 0;
    this.spawnCursor = Math.floor(Math.random() * SPAWNS.length);
    this.botSeq = 0;
    this.closed = false;
  }

  broadcast(event, payload) {
    if (!this.closed) this.io.to(this.code).emit(event, payload);
  }

  humanCount() {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  join(socket, name) {
    const player = makePlayer({ id: socket.id, name, socketId: socket.id });
    this.players.set(player.id, player);
    this.spawnPlayer(player);
    this.lastHumanAt = Date.now();
    this.ensureBots();
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return null;
    this.players.delete(id);
    if (!player.isBot) {
      this.lastHumanAt = Date.now();
      this.broadcast('playerLeft', { id: player.id, name: player.name });
      this.ensureBots();
    }
    return player;
  }

  ensureBots() {
    if (this.closed) return;
    const humans = this.humanCount();
    const desired = clamp(BOT_FILL_TOTAL - humans, 0, 3);
    const bots = [...this.players.values()].filter((p) => p.isBot);

    // Remove excess bots, worst performers first.
    if (bots.length > desired) {
      bots.sort((a, b) => a.kills - b.kills);
      for (let i = 0; i < bots.length - desired; i++) {
        this.players.delete(bots[i].id);
      }
    }

    // Add missing bots.
    const missing = desired - Math.min(bots.length, desired);
    for (let i = 0; i < missing; i++) this.addBot();
  }

  addBot() {
    if (this.players.size >= MAX_PLAYERS + 3) return;
    const used = new Set([...this.players.values()].map((p) => p.name));
    let base = BOT_NAMES.find((n) => !used.has(n)) || `BOT-${this.botSeq + 1}`;
    while (used.has(base)) base = `BOT-${++this.botSeq}`;
    const id = `bot_${this.code}_${++this.botSeq}_${Math.random().toString(36).slice(2, 5)}`;
    const player = makePlayer({ id, name: base, isBot: true });
    player.weapon = 'rifle';
    this.players.set(id, player);
    this.spawnPlayer(player);
    return player;
  }

  pickSpawn(player) {
    const enemies = [...this.players.values()].filter((p) => p !== player && p.alive);
    const scored = SPAWNS.map((s, i) => {
      let minDist = Infinity;
      for (const e of enemies) minDist = Math.min(minDist, Math.hypot(e.x - s.x, e.z - s.z));
      if (!Number.isFinite(minDist)) minDist = 50;
      return { i, score: minDist + Math.random() * 8 };
    });
    scored.sort((a, b) => b.score - a.score);
    const pick = scored[Math.floor(Math.random() * Math.min(3, scored.length))];
    return pick.i;
  }

  spawnPlayer(player) {
    const idx = this.pickSpawn(player);
    const s = SPAWNS[idx];
    const safe = resolveCollision(s.x, s.z, PLAYER_RADIUS);
    player.x = safe.x;
    player.y = 0;
    player.z = safe.z;
    // Look toward the reactor so new spawns never stare at a wall.
    player.yaw = Math.atan2(s.x, s.z);
    player.pitch = 0;
    player.health = PLAYER_MAX_HEALTH;
    player.alive = true;
    player.respawnAt = 0;
    player.lastDamage = 0;
    player.invulnUntil = Date.now() + SPAWN_PROTECTION_MS;
    player.lastMoveAt = 0;
    player.lastShot = Date.now();
    player.streak = 0;
    player.botWaypoint = null;
    player.botBurst = 3;
    this.broadcast('respawn', { id: player.id, x: player.x, y: player.y, z: player.z, yaw: player.yaw });
  }

  setPosition(player, data) {
    if (!player || !player.alive || this.state !== 'playing') return;
    if (!data || typeof data !== 'object') return;
    const x = Number(data.x);
    const z = Number(data.z);
    const y = Number(data.y);
    const yaw = Number(data.yaw);
    const pitch = Number(data.pitch);
    if (![x, z, y, yaw, pitch].every(Number.isFinite)) return;
    if (Math.abs(x) > 100 || Math.abs(z) > 100) return;

    const now = Date.now();
    const dt = clamp((now - (player.lastMoveAt || now - 60)) / 1000, 1 / 120, 0.4);
    player.lastMoveAt = now;

    let nx = x;
    let nz = z;
    const dx = nx - player.x;
    const dz = nz - player.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = SPRINT_SPEED * dt * POSITION_TOLERANCE + 0.55;
    if (dist > maxStep) {
      const k = maxStep / dist;
      nx = player.x + dx * k;
      nz = player.z + dz * k;
    }

    const safe = resolveCollision(nx, nz, PLAYER_RADIUS);
    player.x = safe.x;
    player.z = safe.z;
    player.y = clamp(y, 0, 2.6);
    player.yaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    player.pitch = clamp(pitch, -1.5, 1.5);
  }

  setWeapon(player, weaponId) {
    if (typeof weaponId !== 'string' || !WEAPON_IDS.includes(weaponId)) return;
    if (!player || !player.alive) return;
    player.weapon = weaponId;
  }

  raycastShot(shooter, aimDir) {
    const weapon = WEAPONS[shooter.weapon] || WEAPONS.rifle;
    const origin = { x: shooter.x, y: shooter.y + EYE_HEIGHT, z: shooter.z };
    const ends = [];
    const hits = new Map();

    for (let p = 0; p < weapon.pellets; p++) {
      const dir = spreadDirection(aimDir, weapon.spread);
      let bestT = weapon.range;
      let bestTarget = null;
      let bestHead = false;

      for (const target of this.players.values()) {
        if (target === shooter || !target.alive) continue;
        const hit = rayHitsPlayer(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, target, bestT);
        if (hit && hit.t < bestT) {
          bestT = hit.t;
          bestTarget = target;
          bestHead = hit.head;
        }
      }

      const wallT = rayHitsArena(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
      if (wallT < bestT) {
        bestT = wallT;
        bestTarget = null;
      }
      // Floor / ceiling so tracers always terminate on something visible.
      if (dir.y < -1e-6) {
        const floorT = -origin.y / dir.y;
        if (floorT > 0 && floorT < bestT) {
          bestT = floorT;
          bestTarget = null;
        }
      }

      if (bestT < 0 || !Number.isFinite(bestT)) bestT = weapon.range;
      const end = {
        x: origin.x + dir.x * bestT,
        y: origin.y + dir.y * bestT,
        z: origin.z + dir.z * bestT,
      };
      ends.push(end);

      if (bestTarget) {
        const existing = hits.get(bestTarget.id) || {
          target: bestTarget,
          damage: 0,
          head: false,
          point: end,
        };
        existing.damage += weapon.damage * (bestHead ? weapon.headMultiplier : 1);
        existing.head = existing.head || bestHead;
        hits.set(bestTarget.id, existing);
      }
    }

    return { weapon, origin, ends, hits: [...hits.values()] };
  }

  handleShoot(player, rawDir) {
    if (!player || !player.alive || this.state !== 'playing') return;
    const weapon = WEAPONS[player.weapon] || WEAPONS.rifle;
    const now = Date.now();
    if (now - player.lastShot < weapon.fireDelay * 0.85) return;
    const aimDir = normalizeDir(rawDir);
    if (!aimDir) return;
    player.lastShot = now;

    const { origin, ends, hits } = this.raycastShot(player, aimDir);
    this.broadcast('shot', {
      shooterId: player.id,
      weapon: player.weapon,
      origin,
      dir: aimDir,
      ends,
      bot: player.isBot,
    });

    for (const hit of hits) {
      const damage = player.isBot ? hit.damage * BOT_DAMAGE_SCALE : hit.damage;
      this.damagePlayer(hit.target, damage, player, player.weapon, hit.head, hit.point);
    }
  }

  damagePlayer(target, rawDamage, attacker, weaponId, headshot, point) {
    if (!target || !target.alive || this.state !== 'playing') return;
    // Brief spawn shield: ignores damage from other fighters, never self damage.
    if (target.invulnUntil > Date.now() && attacker !== target) return;
    const weapon = WEAPONS[weaponId] || WEAPONS.rifle;
    const damage = Math.max(1, Math.round(rawDamage));
    target.health -= damage;
    target.lastDamage = Date.now();
    target.lastAttackerId = attacker ? attacker.id : null;
    const killed = target.health <= 0;
    if (killed) target.health = 0;

    this.broadcast('hit', {
      targetId: target.id,
      attackerId: attacker ? attacker.id : null,
      attackerName: attacker ? attacker.name : 'ARENA',
      targetName: target.name,
      damage,
      health: Math.max(0, Math.round(target.health)),
      headshot: !!headshot,
      weapon: weaponId,
      killed,
      point: {
        x: Number.isFinite(point?.x) ? point.x : target.x,
        y: Number.isFinite(point?.y) ? point.y : target.y + 1.2,
        z: Number.isFinite(point?.z) ? point.z : target.z,
      },
    });

    if (killed) this.killPlayer(target, attacker, weaponId, headshot, point);
  }

  killPlayer(victim, killer, weaponId, headshot, point) {
    const now = Date.now();
    victim.alive = false;
    victim.deaths += 1;
    victim.respawnAt = now + RESPAWN_TIME_MS;
    victim.streak = 0;

    if (killer && killer !== victim) {
      killer.kills += 1;
      killer.streak += 1;
      killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
    }

    this.broadcast('kill', {
      killerId: killer ? killer.id : null,
      killerName: killer ? killer.name : 'THE ARENA',
      victimId: victim.id,
      victimName: victim.name,
      weapon: weaponId,
      headshot: !!headshot,
      point: point || null,
      streak: killer ? killer.streak : 0,
    });

    if (killer && killer.streak > 0 && killer.streak % 3 === 0) {
      this.broadcast('notice', {
        text: `${killer.name} is on a ${killer.streak} kill streak!`,
        kind: 'streak',
      });
    }

    const victimSocket = victim.socketId ? this.io.sockets.sockets.get(victim.socketId) : null;
    if (victimSocket) {
      victimSocket.emit('death', {
        killerName: killer ? killer.name : 'THE ARENA',
        weapon: weaponId,
        headshot: !!headshot,
        respawnIn: RESPAWN_TIME_MS,
      });
    }
  }

  buildSnapshot(now) {
    return {
      t: now,
      state: this.state,
      timeLeft: Math.max(0, Math.round(((this.matchEndsAt - now) / 1000) * 10) / 10),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.isBot,
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        z: Math.round(p.z * 100) / 100,
        yaw: Math.round(p.yaw * 1000) / 1000,
        pitch: Math.round(p.pitch * 1000) / 1000,
        health: Math.max(0, Math.round(p.health)),
        shield: p.invulnUntil > now,
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        streak: p.streak,
        weapon: p.weapon,
      })),
    };
  }

  tick(dt, now) {
    // Health regeneration.
    if (this.state === 'playing') {
      const rate = HEALTH_REGEN_PER_SEC;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (now - p.lastDamage > HEALTH_REGEN_DELAY_MS && p.health < PLAYER_MAX_HEALTH) {
          p.health = Math.min(PLAYER_MAX_HEALTH, p.health + rate * dt);
        }
      }
    }

    // Respawns.
    for (const p of this.players.values()) {
      if (!p.alive && p.respawnAt && now >= p.respawnAt && this.state === 'playing') {
        this.spawnPlayer(p);
      }
    }

    // Bots.
    for (const p of this.players.values()) {
      if (p.isBot) this.updateBot(p, dt, now);
    }

    // Match clock.
    if (this.state === 'playing' && now >= this.matchEndsAt) {
      this.endMatch(now);
    } else if (this.state === 'ended' && this.restartAt && now >= this.restartAt) {
      this.restartMatch(now);
    }
  }

  endMatch(now) {
    this.state = 'ended';
    this.matchEndsAt = now;
    this.restartAt = now + MATCH_RESTART_MS;
    this.broadcast('matchEnd', { standings: this.standings(), restartIn: MATCH_RESTART_MS });
  }

  standings() {
    return [...this.players.values()]
      .map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.isBot,
        kills: p.kills,
        deaths: p.deaths,
        bestStreak: p.bestStreak,
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  restartMatch(now) {
    this.state = 'playing';
    this.matchEndsAt = now + MATCH_DURATION_MS;
    this.restartAt = 0;
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.bestStreak = 0;
      p.streak = 0;
      this.spawnPlayer(p);
    }
    this.broadcast('matchStart', { timeLeft: MATCH_DURATION_MS / 1000 });
  }

  updateBot(bot, dt, now) {
    if (!bot.alive) return;
    if (this.state !== 'playing') return;

    if (now >= bot.botNextThink) {
      bot.botNextThink = now + 320 + Math.random() * 420;
      let best = null;
      let bestScore = Infinity;
      for (const other of this.players.values()) {
        if (other === bot || !other.alive) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        const score = d * (other.isBot ? 1.15 : 1);
        if (score < bestScore) {
          bestScore = score;
          best = other;
        }
      }
      const nextTargetId = best ? best.id : null;
      if (nextTargetId !== bot.botTargetId) {
        // Brief reaction window when a bot acquires a new target.
        bot.botNextShot = Math.max(bot.botNextShot, now + 400 + Math.random() * 450);
        bot.botBurst = 2 + Math.floor(Math.random() * 3);
      }
      bot.botTargetId = nextTargetId;
    }

    const target = bot.botTargetId ? this.players.get(bot.botTargetId) : null;

    let moveX = 0;
    let moveZ = 0;
    let desiredYaw = bot.yaw;

    if (target && target.alive) {
      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const dist = Math.hypot(dx, dz) || 1;
      const toX = dx / dist;
      const toZ = dz / dist;
      desiredYaw = Math.atan2(-toX, -toZ);

      const strafeDir = Math.sin(now / 900 + bot.botSeed) > 0 ? 1 : -1;
      const strafeX = -toZ * strafeDir;
      const strafeZ = toX * strafeDir;

      if (dist > 17) {
        moveX += toX;
        moveZ += toZ;
      } else if (dist < 7) {
        moveX -= toX * 0.9;
        moveZ -= toZ * 0.9;
      }
      moveX += strafeX * 0.85;
      moveZ += strafeZ * 0.85;
      bot.botWaypoint = null;
    } else {
      if (!bot.botWaypoint || Math.hypot(bot.botWaypoint.x - bot.x, bot.botWaypoint.z - bot.z) < 2) {
        bot.botWaypoint = { x: (Math.random() * 2 - 1) * 26, z: (Math.random() * 2 - 1) * 26 };
      }
      const dx = bot.botWaypoint.x - bot.x;
      const dz = bot.botWaypoint.z - bot.z;
      const dist = Math.hypot(dx, dz) || 1;
      moveX = dx / dist;
      moveZ = dz / dist;
      desiredYaw = Math.atan2(-moveX, -moveZ);
    }

    // Basic obstacle avoidance: if we are barely moving, pick a new direction.
    const beforeX = bot.x;
    const beforeZ = bot.z;
    const speed = 5.6;
    const len = Math.hypot(moveX, moveZ) || 1;
    const safe = resolveCollision(bot.x + (moveX / len) * speed * dt, bot.z + (moveZ / len) * speed * dt, PLAYER_RADIUS);
    bot.x = safe.x;
    bot.z = safe.z;
    const moved = Math.hypot(bot.x - beforeX, bot.z - beforeZ);
    if (moved < speed * dt * 0.3) {
      if (now - bot.botStuckAt > 700) {
        bot.botStuckAt = now;
        bot.botWaypoint = { x: (Math.random() * 2 - 1) * 26, z: (Math.random() * 2 - 1) * 26 };
        bot.yaw += (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random());
      }
    }

    bot.yaw = lerpAngle(bot.yaw, desiredYaw, Math.min(1, dt * 7));

    if (target && target.alive) {
      const eyeY = bot.y + EYE_HEIGHT;
      const tx = target.x;
      const ty = target.y + 1.25;
      const tz = target.z;
      const dx = tx - bot.x;
      const dy = ty - eyeY;
      const dz = tz - bot.z;
      const dist = Math.hypot(dx, dy, dz);
      const wallT = rayHitsArena(bot.x, eyeY, bot.z, dx / dist, dy / dist, dz / dist);
      const canSee = wallT > dist - 0.5;
      const weapon = WEAPONS[bot.weapon] || WEAPONS.rifle;

      if (canSee && dist < weapon.range * 0.85 && now >= bot.botNextShot) {
        const spreadBase = 0.045 + Math.random() * 0.06 + (dist > 22 ? 0.03 : 0);
        const yawErr = (Math.random() * 2 - 1) * spreadBase;
        const pitchErr = (Math.random() * 2 - 1) * spreadBase * 0.7;
        const cp = Math.cos(yawErr);
        const sp = Math.sin(yawErr);
        const dir = {
          x: (dx / dist) * cp + (dz / dist) * sp,
          y: dy / dist + pitchErr,
          z: (dz / dist) * cp - (dx / dist) * sp,
        };
        this.handleShoot(bot, dir);

        // Fire in short bursts with a recovery pause so fights stay readable.
        bot.botBurst -= 1;
        if (bot.botBurst <= 0) {
          bot.botBurst = 2 + Math.floor(Math.random() * 3);
          bot.botNextShot = now + 750 + Math.random() * 550;
        } else {
          bot.botNextShot = now + 250 + Math.random() * 170;
        }
      }
    }
  }
}

export class GameServer {
  constructor(io, log = console) {
    this.io = io;
    this.log = log;
    this.rooms = new Map();
    this.tickTimer = null;
    this.snapshotTimer = null;
    this.cleanupTimer = null;
  }

  start() {
    this.io.on('connection', (socket) => this.onConnection(socket));

    let last = Date.now();
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      const dt = clamp((now - last) / 1000, 0, 0.1);
      last = now;
      for (const room of this.rooms.values()) {
        try {
          room.tick(dt, now);
        } catch (err) {
          this.log.error(`[room ${room.code}] tick error:`, err);
        }
      }
    }, 1000 / TICK_HZ);

    this.snapshotTimer = setInterval(() => {
      const now = Date.now();
      for (const room of this.rooms.values()) {
        if (room.players.size > 0) {
          this.io.to(room.code).emit('snapshot', room.buildSnapshot(now));
        }
      }
    }, 1000 / SNAPSHOT_HZ);

    this.cleanupTimer = setInterval(() => this.cleanup(), 5000);
    this.log.info('[neon-rift] game loop online');
  }

  stop() {
    clearInterval(this.tickTimer);
    clearInterval(this.snapshotTimer);
    clearInterval(this.cleanupTimer);
    this.rooms.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.humanCount() === 0 && now - room.lastHumanAt > ROOM_LINGER_MS) {
        room.closed = true;
        this.rooms.delete(code);
        this.log.info(`[neon-rift] room ${code} closed (idle)`);
      }
    }
  }

  onConnection(socket) {
    socket.data.joined = false;
    socket.data.lastAction = 0;

    socket.on('join', (data) => this.handleJoin(socket, data));
    socket.on('move', (data) => this.handleMove(socket, data));
    socket.on('shoot', (data) => this.handleClientShoot(socket, data));
    socket.on('weapon', (data) => this.handleWeapon(socket, data));
    socket.on('leave', () => this.leaveRoom(socket));
    socket.on('requestSnapshot', () => {
      const room = this.roomFor(socket);
      if (room) socket.emit('snapshot', room.buildSnapshot(Date.now()));
    });
    socket.on('disconnect', () => this.leaveRoom(socket));
    socket.on('error', (err) => this.log.warn(`[socket ${socket.id}] ${err?.message || err}`));
  }

  roomFor(socket) {
    const code = socket.data.roomCode;
    return code ? this.rooms.get(code) : null;
  }

  handleJoin(socket, data) {
    try {
      if (socket.data.joined) {
        socket.emit('errorMsg', { message: 'You are already in a match.' });
        return;
      }
      const name = sanitizeName(data?.name) || 'RECRUIT';
      let requested = sanitizeRoomCode(data?.room);
      if (data?.room && String(data.room).toUpperCase() !== 'AUTO' && !requested) {
        socket.emit('errorMsg', { message: 'Room code must be 2-10 letters or numbers.' });
        return;
      }

      if (!requested) {
        const joinable = [...this.rooms.values()].filter(
          (r) => !r.closed && r.state === 'playing' && r.humanCount() > 0 && r.humanCount() < MAX_PLAYERS,
        );
        joinable.sort((a, b) => b.humanCount() - a.humanCount());
        let chosen = joinable[0];
        if (!chosen) {
          if (this.rooms.size >= MAX_ROOMS) {
            socket.emit('errorMsg', { message: 'Server is at capacity. Try again shortly.' });
            return;
          }
          let code = randomCode();
          let guard = 0;
          while (this.rooms.has(code) && guard++ < 20) code = randomCode();
          chosen = new Room(code, this.io);
          this.rooms.set(code, chosen);
          this.log.info(`[neon-rift] created room ${code}`);
        }
        requested = chosen.code;
      }

      let room = this.rooms.get(requested);
      if (!room) {
        if (this.rooms.size >= MAX_ROOMS) {
          socket.emit('errorMsg', { message: 'Server is at capacity. Try again shortly.' });
          return;
        }
        room = new Room(requested, this.io);
        this.rooms.set(requested, room);
        this.log.info(`[neon-rift] created room ${requested}`);
      }

      if (room.humanCount() >= MAX_PLAYERS) {
        socket.emit('errorMsg', { message: 'That room is full (8 players max).' });
        return;
      }

      if (room.state === 'ended') {
        // Let players join during the results screen; they spawn next round.
        room.matchEndsAt = Date.now();
      }

      socket.join(room.code);
      socket.data.joined = true;
      socket.data.roomCode = room.code;

      const player = room.join(socket, name);
      socket.emit('joined', {
        selfId: player.id,
        name: player.name,
        room: {
          code: room.code,
          state: room.state,
          timeLeft: Math.max(0, (room.matchEndsAt - Date.now()) / 1000),
        },
        players: room.buildSnapshot(Date.now()).players,
        serverTime: Date.now(),
      });
      socket.to(room.code).emit('playerJoined', { id: player.id, name: player.name });
      if (room.state === 'ended') {
        socket.emit('matchEnd', {
          standings: room.standings(),
          restartIn: Math.max(1000, (room.restartAt || Date.now()) - Date.now()),
        });
      }
      this.log.info(`[neon-rift] ${name} joined room ${room.code} (${room.humanCount()} human)`);
    } catch (err) {
      this.log.error('[neon-rift] join failed:', err);
      socket.emit('errorMsg', { message: 'Could not join the arena. Please retry.' });
    }
  }

  handleMove(socket, data) {
    const room = this.roomFor(socket);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) room.setPosition(player, data);
  }

  handleClientShoot(socket, data) {
    const room = this.roomFor(socket);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    try {
      room.handleShoot(player, data?.dir);
    } catch (err) {
      this.log.error('[neon-rift] shot failed:', err);
    }
  }

  handleWeapon(socket, data) {
    const room = this.roomFor(socket);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) room.setWeapon(player, data?.weapon);
  }

  leaveRoom(socket) {
    const room = this.roomFor(socket);
    if (!room) {
      socket.data.joined = false;
      socket.data.roomCode = null;
      return;
    }
    room.removePlayer(socket.id);
    socket.leave(room.code);
    socket.data.joined = false;
    socket.data.roomCode = null;
  }
}
