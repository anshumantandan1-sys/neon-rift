/** Server-side tuning constants (mirrored subset on the client for UI/feel). */

export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 20;
export const MAX_PLAYERS = 8;

export const MATCH_DURATION_MS = 5 * 60 * 1000; // 5 minute deathmatch
export const MATCH_RESTART_MS = 14 * 1000;
export const RESPAWN_TIME_MS = 3400;
export const SPAWN_PROTECTION_MS = 3000;
export const BOT_FILL_TOTAL = 4; // room stays lively with up to 3 bots
export const BOT_DAMAGE_SCALE = 0.62; // aimbots track perfectly, so soften their hits
export const ROOM_LINGER_MS = 25 * 1000;
export const MAX_ROOMS = 300;

/** Everyone gets five robot bodies per match. */
export const MAX_LIVES = 5;
/** Dodge burst: i-frames + a fast sidestep. */
export const DODGE_COOLDOWN_MS = 2600;
export const DODGE_INVULN_MS = 460;
export const DODGE_SPEED = 23;

export const PLAYER_MAX_HEALTH = 100;
export const HEALTH_REGEN_DELAY_MS = 4600;
export const HEALTH_REGEN_PER_SEC = 16;

export const WALK_SPEED = 8.2;
export const SPRINT_SPEED = 11.6;
export const POSITION_TOLERANCE = 2.6; // multiplier on allowed distance per packet (covers dodge bursts)

/** Huntable countryside animals. Kills heal the hunter and count as "hunts". */
export const ANIMAL_COUNT = 7;
export const ANIMAL_RESPAWN_MS = 22000;
export const ANIMALS = {
  deer: { id: 'deer', label: 'DEER', health: 45, heal: 25, radius: 0.55, height: 1.55, speed: 2.2 },
  bear: { id: 'bear', label: 'BEAR', health: 85, heal: 35, radius: 0.72, height: 1.75, speed: 1.7 },
  chicken: { id: 'chicken', label: 'CHICKEN', health: 18, heal: 10, radius: 0.24, height: 0.55, speed: 2.4 },
};

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Vanguard Pistol',
    short: 'PISTOL',
    damage: 23,
    headMultiplier: 2,
    fireDelay: 145,
    pellets: 1,
    spread: 0.008,
    range: 130,
    mag: 14,
    reloadMs: 1050,
    auto: false,
    color: '#4de3ff',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Ranch Sweeper',
    short: 'SWEEPER',
    damage: 11,
    headMultiplier: 1.6,
    fireDelay: 860,
    pellets: 9,
    spread: 0.07,
    range: 46,
    mag: 6,
    reloadMs: 1850,
    auto: false,
    color: '#ff8a3d',
  },
  rifle: {
    id: 'rifle',
    name: 'Ranger Rifle',
    short: 'RANGER',
    damage: 13,
    headMultiplier: 2,
    fireDelay: 105,
    pellets: 1,
    spread: 0.02,
    range: 170,
    mag: 32,
    reloadMs: 1550,
    auto: true,
    color: '#8dff6b',
  },
  smg: {
    id: 'smg',
    name: 'Hornet SMG',
    short: 'HORNET',
    damage: 9,
    headMultiplier: 1.8,
    fireDelay: 78,
    pellets: 1,
    spread: 0.03,
    range: 110,
    mag: 40,
    reloadMs: 1350,
    auto: true,
    color: '#ffd24a',
  },
  dmr: {
    id: 'dmr',
    name: 'Longshot DMR',
    short: 'LONGSHOT',
    damage: 36,
    headMultiplier: 2.3,
    fireDelay: 430,
    pellets: 1,
    spread: 0.003,
    range: 240,
    mag: 8,
    reloadMs: 1750,
    auto: false,
    color: '#7df3ff',
  },
};

export const WEAPON_IDS = ['pistol', 'shotgun', 'rifle', 'smg', 'dmr'];

export const BOT_NAMES = [
  'BOLT-7',
  'RUSTY',
  'COGBOT',
  'AXLE',
  'WRENCH',
  'TINMAN',
  'SPROCKET',
  'PISTON',
  'VOLT',
  'GEARBOX',
];
