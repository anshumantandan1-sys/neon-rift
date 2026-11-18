/**
 * Deterministic server-side smoke test for NEON RIFT v1.1.
 * Exercises rooms, hit registration, headshots, kills, five-life elimination,
 * respawns, dodge i-frames, animals, movement validation, match lifecycle and
 * bot filling without needing a browser.
 *
 * Run with: npm run smoke
 */
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { ANIMALS, DODGE_INVULN_MS, MAX_LIVES, WEAPONS } from '../server/config.js';
import { PLAYER_RADIUS, resolveCollision } from '../public/js/arena.js';

// Remove random pellet spread so hit tests are deterministic.
const savedSpread = WEAPONS.rifle.spread;
WEAPONS.rifle.spread = 0;

const events = [];
const deathEvents = [];
const io = {
  to: () => ({
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  }),
  sockets: { sockets: new Map() },
};

function fakeSocket(id) {
  return {
    emit: (event, payload) => deathEvents.push({ id, event, payload }),
  };
}
io.sockets.sockets.set('sock_b', fakeSocket('sock_b'));
io.sockets.sockets.set('elim_b', fakeSocket('elim_b'));

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

function latestDeath(id, event = 'death') {
  for (let i = deathEvents.length - 1; i >= 0; i--) {
    if (deathEvents[i].id === id && deathEvents[i].event === event) return deathEvents[i].payload;
  }
  return null;
}

function place(player, x, z, yaw = 0) {
  player.x = x;
  player.z = z;
  player.y = 0;
  player.yaw = yaw;
  player.pitch = 0;
  player.health = 100;
  player.alive = true;
  player.eliminated = false;
  player.lastDamage = 0;
  player.lastShot = 0;
  player.lastMoveAt = 0;
  player.respawnAt = 0;
  player.invulnUntil = 0;
  player.dodgeUntil = 0;
  player.dodgeReadyAt = 0;
  player.streak = 0;
}

function clearBots(room) {
  for (const p of [...room.players.values()]) {
    if (p.isBot) room.players.delete(p.id);
  }
}

console.log('\nNEON RIFT — server smoke test\n');

// ------------------------------------------------------------------
// Room setup
// ------------------------------------------------------------------
const room = new Room('TEST', io);
const alpha = room.join({ id: 'sock_a' }, 'Alpha', 'dmr');
const bravo = room.join({ id: 'sock_b' }, 'Bravo');

ok(room.state === 'playing', 'room starts in a live match');
ok(room.humanCount() === 2, 'two human players joined');
ok(alpha.lives === MAX_LIVES && bravo.lives === MAX_LIVES, `every fighter starts with ${MAX_LIVES} lives`);
ok(alpha.weapon === 'dmr', 'join loadout is applied to the fighter');
ok(room.animals.size === 7, 'seven huntable animals roam the pasture');
const initialKinds = new Set([...room.animals.values()].map((a) => a.kind));
ok(initialKinds.has('bear') && initialKinds.has('deer') && initialKinds.has('chicken'), 'wildlife includes deer, bears and chickens');
ok(!initialKinds.has('cow'), 'the cow has been replaced by the bear');

clearBots(room);
ok([...room.players.values()].filter((p) => p.isBot).length === 0, 'test arena cleared of bots');

// Clear ambient animals so damage tests are fully deterministic.
room.animals.clear();

// ------------------------------------------------------------------
// Spawn protection
// ------------------------------------------------------------------
place(alpha, -20, 24);
place(bravo, -20, 14);
bravo.invulnUntil = Date.now() + 800;
alpha.weapon = 'rifle';
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
ok(!latest('hit'), 'spawn protection blocks incoming damage');
bravo.invulnUntil = 0;

// ------------------------------------------------------------------
// Hit registration & headshots
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Rate limiting
// ------------------------------------------------------------------
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
ok(!latest('hit'), 'fire-rate limit blocks a second shot in the same instant');

// ------------------------------------------------------------------
// Dodge i-frames
// ------------------------------------------------------------------
place(alpha, -20, 24);
place(bravo, -20, 14);
alpha.weapon = 'rifle';
bravo.dodgeUntil = Date.now() + DODGE_INVULN_MS;
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
ok(!latest('hit'), 'dodge i-frames absorb incoming fire');
bravo.dodgeUntil = 0;

events.length = 0;
const dodged = room.tryDodge(bravo, { x: 1, z: 0 });
const dodgeEvent = latest('dodge');
ok(dodged === true, 'a ready fighter can combat-dodge');
ok(dodgeEvent && dodgeEvent.id === 'sock_b' && dodgeEvent.invulnMs === DODGE_INVULN_MS, 'dodge broadcasts its i-frame window');
ok(room.tryDodge(bravo, { x: 1, z: 0 }) === false, 'dodge respects its cooldown');
bravo.dodgeUntil = 0;
bravo.dodgeReadyAt = 0;

// ------------------------------------------------------------------
// Kill, score, lives and death payload
// ------------------------------------------------------------------
for (let i = 0; i < 4; i++) {
  alpha.lastShot = 0;
  room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
}
const kill = latest('kill');
const death = latestDeath('sock_b');
ok(kill && kill.killerId === 'sock_a' && kill.victimId === 'sock_b', 'kill event names killer and victim');
ok(alpha.kills === 1, 'killer score incremented');
ok(bravo.deaths === 1 && bravo.alive === false, 'victim marked dead with a death recorded');
ok(bravo.lives === MAX_LIVES - 1, 'a wreck costs exactly one life');
ok(bravo.eliminated === false, 'fighter with lives left is not eliminated');
ok(bravo.respawnAt > Date.now(), 'victim has a pending respawn timer');
ok(death && death.lives === MAX_LIVES - 1 && death.eliminated === false, 'death payload reports remaining lives');
ok(room.state === 'playing', 'match continues while two fighters still have lives');

// ------------------------------------------------------------------
// Respawn
// ------------------------------------------------------------------
bravo.respawnAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
ok(bravo.alive === true && bravo.health === 100, 'victim respawns at full health');
ok(bravo.lives === MAX_LIVES - 1, 'respawn does not restore lost lives');
ok(bravo.invulnUntil > Date.now(), 'respawn grants a protective shield');

// ------------------------------------------------------------------
// Cover blocks shots
// ------------------------------------------------------------------
place(alpha, 0, 10);
place(bravo, 0, -10);
alpha.weapon = 'rifle';
alpha.lastShot = 0;
events.length = 0;
room.handleShoot(alpha, { x: 0, y: 0, z: -1 });
hit = latest('hit');
ok(!hit || hit.targetId !== 'sock_b', 'central stone ruin blocks line of fire');

// ------------------------------------------------------------------
// Health regeneration
// ------------------------------------------------------------------
place(bravo, -20, 14);
bravo.health = 40;
bravo.lastDamage = Date.now() - 6000;
room.tick(1.0, Date.now());
ok(bravo.health > 40, 'health regenerates after the damage cooldown');

// ------------------------------------------------------------------
// Weapon validation
// ------------------------------------------------------------------
room.setWeapon(alpha, 'not-a-gun');
ok(alpha.weapon === 'rifle', 'invalid weapon ids are rejected');
room.setWeapon(alpha, 'smg');
ok(alpha.weapon === 'smg', 'valid weapon ids are accepted');

// ------------------------------------------------------------------
// Movement validation
// ------------------------------------------------------------------
place(alpha, 0, 24);
alpha.lastMoveAt = Date.now() - 1000;
room.setPosition(alpha, { x: 60, z: 24, y: 0, yaw: 0.2, pitch: 0.1 });
ok(alpha.x < 15, 'large teleport attempt is clamped to a legal speed');
ok(Math.abs(alpha.yaw - 0.2) < 1e-6, 'legal look angle is accepted');

const pushed = resolveCollision(0, 0, PLAYER_RADIUS);
ok(Math.hypot(pushed.x, pushed.z) > 3.4, 'collision solver ejects players from solid cover');

// ------------------------------------------------------------------
// Huntable animals
// ------------------------------------------------------------------
room.animals.clear();
place(alpha, 0, 24);
place(bravo, 30, 30);
alpha.weapon = 'rifle';
alpha.health = 100;
alpha.hunts = 0;

const chicken = room.spawnAnimal('chicken', 0);
chicken.x = 0;
chicken.z = 14;
chicken.y = 0;
chicken.health = ANIMALS.chicken.health;
chicken.maxHealth = ANIMALS.chicken.health;
chicken.alive = true;
chicken.wanderX = chicken.x;
chicken.wanderZ = chicken.z;

const aimAtChicken = { x: 0, y: -0.11, z: -1 };
events.length = 0;
room.handleShoot(alpha, aimAtChicken);
let animalHit = latest('animalHit');
ok(animalHit && animalHit.animalId === chicken.id, 'shots can hit ambient wildlife');
ok(animalHit && animalHit.killed === false && animalHit.health === ANIMALS.chicken.health - 13, 'animal damage is tracked');

alpha.health = 70;
alpha.lastShot = 0;
room.handleShoot(alpha, aimAtChicken);
const animalKill = latest('animalKilled');
ok(animalKill && animalKill.animalId === chicken.id, 'animal kill is broadcast');
ok(chicken.alive === false && chicken.respawnAt > Date.now(), 'hunted animal drops and schedules a respawn');
ok(alpha.hunts === 1, 'hunter earns a hunt count');
ok(alpha.health === 80, 'hunting heals the attacker');

// Animal respawn.
chicken.respawnAt = Date.now() - 1;
room.updateAnimals(1 / 30, Date.now());
ok(chicken.alive === true && chicken.health === ANIMALS.chicken.health, 'animals respawn after their timer');
ok(chicken.respawnAt === 0, 'respawned animal clears its timer');

// Bears are the heavy game animal.
room.animals.clear();
const bear = room.spawnAnimal('bear', 0);
bear.x = 0;
bear.z = 5;
bear.y = 0;
bear.health = ANIMALS.bear.health;
bear.maxHealth = ANIMALS.bear.health;
bear.alive = true;
bear.wanderX = bear.x;
bear.wanderZ = bear.z;
bear.respawnAt = 0;

place(alpha, 0, 24);
place(bravo, 30, 30);
alpha.weapon = 'dmr';
alpha.health = 40;
alpha.hunts = 0;
events.length = 0;
for (let i = 0; i < 3; i++) {
  alpha.lastShot = 0;
  room.handleShoot(alpha, { x: 0, y: -0.03, z: -1 });
}
const bearKill = latest('animalKilled');
ok(bearKill && bearKill.kind === 'bear' && bearKill.label === 'BEAR', 'bears can be hunted');
ok(bear.alive === false && alpha.hunts === 1, 'a bear kill counts toward the hunt total');
ok(alpha.health === 75, 'hunting a bear restores 35 hull');

// ------------------------------------------------------------------
// Five-life elimination & last-standing early end
// ------------------------------------------------------------------
const elimRoom = new Room('ELIM', io);
const elimA = elimRoom.join({ id: 'elim_a' }, 'ElimA');
const elimB = elimRoom.join({ id: 'elim_b' }, 'ElimB');
clearBots(elimRoom);
elimRoom.animals.clear();
ok(elimRoom.state === 'playing', 'elimination room starts live');

place(elimA, -20, 24);
place(elimB, -20, 14);
elimA.weapon = 'rifle';
elimB.lives = 1;
elimB.health = 20;
events.length = 0;
elimRoom.handleShoot(elimA, { x: 0, y: 0, z: -1 });

const elimKill = latest('kill');
const elimDeath = latestDeath('elim_b');
ok(elimB.alive === false && elimB.lives === 0, 'last life is consumed on the final wreck');
ok(elimB.eliminated === true, 'fighter with zero lives is eliminated');
ok(elimB.respawnAt === 0, 'eliminated fighter has no respawn timer');
ok(elimKill && elimKill.eliminated === true && elimKill.lives === 0, 'kill event flags the elimination');
ok(elimDeath && elimDeath.eliminated === true && elimDeath.lives === 0, 'death payload flags the elimination');
ok(elimRoom.state === 'ended' && elimRoom.endReason === 'last-standing', 'match ends early when one fighter remains');
const elimEnd = latest('matchEnd');
ok(elimEnd && elimEnd.reason === 'last-standing' && elimEnd.standings.length === 2, 'early end broadcasts final standings');

elimRoom.tick(1 / 30, Date.now());
ok(elimB.alive === false, 'eliminated fighter stays down for the rest of the round');

// ------------------------------------------------------------------
// Match lifecycle
// ------------------------------------------------------------------
alpha.kills = 7;
bravo.kills = 3;
alpha.deaths = 2;
room.matchEndsAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
const end = latest('matchEnd');
ok(room.state === 'ended', 'match ends when the clock expires');
ok(end && end.reason === 'time', 'time expiry is reported as the end reason');
ok(end && end.standings[0].name === 'Alpha' && end.standings[0].kills === 7, 'final standings are sorted by kills');

room.restartAt = Date.now() - 1;
room.tick(1 / 30, Date.now());
ok(room.state === 'playing', 'match automatically restarts');
ok(alpha.kills === 0 && bravo.kills === 0 && alpha.alive, 'scores reset and everyone respawns after restart');
ok(alpha.lives === MAX_LIVES && bravo.lives === MAX_LIVES, 'lives reset for the new match');
ok(alpha.hunts === 0, 'hunt counts reset for the new match');

// ------------------------------------------------------------------
// Snapshots & bots
// ------------------------------------------------------------------
const snap = room.buildSnapshot(Date.now());
ok(Array.isArray(snap.players) && snap.players.length >= 2, 'snapshot contains the player roster');
const selfSnap = snap.players.find((p) => p.id === 'sock_a');
ok(selfSnap && typeof selfSnap.x === 'number' && typeof selfSnap.alive === 'boolean', 'snapshot player shape is valid');
ok(
  selfSnap && typeof selfSnap.lives === 'number' && typeof selfSnap.hunts === 'number',
  'snapshot carries lives and hunts',
);
ok(
  selfSnap && typeof selfSnap.dodgeIn === 'number' && typeof selfSnap.dodging === 'boolean',
  'snapshot carries dodge state',
);
ok(Array.isArray(snap.animals) && snap.animals.length > 0, 'snapshot carries ambient animals');
ok(typeof snap.timeLeft === 'number' && snap.state === 'playing', 'snapshot carries match timer and state');

room.ensureBots();
ok([...room.players.values()].filter((p) => p.isBot).length === 2, 'bots fill empty slots (2 humans → 2 bots)');
room.removePlayer('sock_b');
ok([...room.players.values()].filter((p) => p.isBot).length === 3, 'more bots spawn when a human leaves');
ok(!room.players.has('sock_b'), 'leaving player is removed from the room');

WEAPONS.rifle.spread = savedSpread;

console.log(`\nAll ${checks} checks passed. NEON RIFT server logic is healthy.\n`);
