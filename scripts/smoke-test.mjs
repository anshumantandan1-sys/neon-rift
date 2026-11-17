/**
 * Deterministic server-side smoke test for NEON RIFT.
 * Exercises rooms, hit registration, headshots, kills, respawns, movement
 * validation, match lifecycle and bot filling without needing a browser.
 *
 * Run with: npm run smoke
 */
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { WEAPONS } from '../server/config.js';
import { PLAYER_RADIUS, resolveCollision } from '../public/js/arena.js';

// Remove random pellet spread so hit tests are deterministic.
const savedSpread = WEAPONS.rifle.spread;
WEAPONS.rifle.spread = 0;

const events = [];
const io = {
  to: () => ({
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  }),
  sockets: { sockets: new Map() },
};

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`  ✓ ${message}`);
}

function latest(event) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === event) return events[i].payload;
  }
  return null;
}

console.log('\nNEON RIFT — server smoke test\n');

const room = new Room('TEST', io);
const alpha = room.join({ id: 'sock_a' }, 'Alpha');
const bravo = room.join({ id: 'sock_b' }, 'Bravo');

ok(room.state === 'playing', 'room starts in a live match');
ok(room.humanCount() === 2, 'two human players joined');

// Remove bots so the damage tests are fully deterministic.
for (const p of [...room.players.values()]) {
  if (p.isBot) room.players.delete(p.id);
}
ok([...room.players.values()].filter((p) => p.isBot).length === 0, 'test arena cleared of bots');

function place(player, x, z, yaw = 0) {
  player.x = x;
  player.z = z;
  player.y = 0;
  player.yaw = yaw;
  player.pitch = 0;
  player.health = 100;
  player.alive = true;
  player.lastDamage = 0;
  player.lastShot = 0;
  player.lastMoveAt = 0;
  player.respawnAt = 0;
  player.invulnUntil = 0;
  player.streak = 0;
}

// -------- spawn protection --------
place(alpha, -20, 24);
place(bravo, -20, 14);
bravo.invulnUntil = Date.now() + 800;
alpha.weapon = 'rifle';
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
ok(!latest('hit'), 'spawn protection blocks incoming damage');
bravo.invulnUntil = 0;

// -------- hit registration & headshots --------
place(alpha, -20, 24);
place(bravo, -20, 14);
alpha.weapon = 'rifle';
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
let hit = latest('hit');
ok(!!latest('shot'), 'shooting broadcasts a tracer event');
ok(hit && hit.attackerId === 'sock_a' && hit.targetId === 'sock_b', 'server registered a player hit');
ok(hit && hit.damage === 26, 'eye-level hit counts as a headshot (13 dmg x2)');
ok(bravo.health === 74, 'victim health reduced by the correct damage');

// -------- rate limiting --------
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
ok(!latest('hit'), 'fire-rate limit blocks a second shot in the same instant');

// -------- kill, score and death --------
for (let i = 0; i < 3; i++) {
  alpha.lastShot = 0;
  room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
}
const kill = latest('kill');
ok(kill && kill.killerId === 'sock_a' && kill.victimId === 'sock_b', 'kill event names killer and victim');
ok(alpha.kills === 1, 'killer score incremented');
ok(bravo.deaths === 1 && bravo.alive === false, 'victim marked dead with a death recorded');
ok(bravo.respawnAt > Date.now(), 'victim has a pending respawn timer');
WEAPONS.rifle.spread = savedSpread;

// -------- respawn --------
bravo.respawnAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
ok(bravo.alive === true && bravo.health === 100, 'victim respawns at full health');

// -------- cover blocks shots --------
place(alpha, 0, 10);
place(bravo, 0, -10);
alpha.lastShot = 0;
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
hit = latest('hit');
ok(!hit || hit.targetId !== 'sock_b', 'central reactor tower blocks line of fire');

// -------- health regeneration --------
bravo.health = 40;
bravo.lastDamage = Date.now() - 6000;
room.tick(1.0, Date.now());
ok(bravo.health > 40, 'health regenerates after the damage cooldown');

// -------- movement validation --------
alpha.alive = true;
alpha.x = 0;
alpha.z = 24;
alpha.lastMoveAt = Date.now() - 1000;
room.setPosition(alpha, { x: 60, z: 24, y: 0, yaw: 0.2, pitch: 0.1 });
ok(alpha.x < 15, 'large teleport attempt is clamped to a legal speed');
ok(Math.abs(alpha.yaw - 0.2) < 1e-6, 'legal look angle is accepted');

const pushed = resolveCollision(0, 0, PLAYER_RADIUS);
ok(Math.hypot(pushed.x, pushed.z) > 3.4, 'collision solver ejects players from solid cover');

// -------- match lifecycle --------
alpha.kills = 7;
bravo.kills = 3;
alpha.deaths = 2;
room.matchEndsAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
const end = latest('matchEnd');
ok(room.state === 'ended', 'match ends when the clock expires');
ok(end && end.standings[0].name === 'Alpha' && end.standings[0].kills === 7, 'final standings are sorted by kills');

room.restartAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
ok(room.state === 'playing', 'match automatically restarts');
ok(alpha.kills === 0 && bravo.kills === 0 && alpha.alive, 'scores reset and everyone respawns after restart');

// -------- snapshots & bots --------
const snap = room.buildSnapshot(Date.now());
ok(Array.isArray(snap.players) && snap.players.length >= 2, 'snapshot contains the player roster');
const selfSnap = snap.players.find((p) => p.id === 'sock_a');
ok(selfSnap && typeof selfSnap.x === 'number' && typeof selfSnap.alive === 'boolean', 'snapshot player shape is valid');
ok(typeof snap.timeLeft === 'number' && snap.state === 'playing', 'snapshot carries match timer and state');

room.ensureBots();
ok([...room.players.values()].filter((p) => p.isBot).length === 2, 'bots fill empty slots (2 humans → 2 bots)');
room.removePlayer('sock_b');
ok([...room.players.values()].filter((p) => p.isBot).length === 3, 'more bots spawn when a human leaves');
ok(!room.players.has('sock_b'), 'leaving player is removed from the room');

console.log(`\nAll ${checks} checks passed. NEON RIFT server logic is healthy.\n`);
