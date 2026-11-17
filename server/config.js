/** Server-side tuning constants (mirrored subset on the client for UI/feel). */

export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 20;
export const MAX_PLAYERS = 8;

export const MATCH_DURATION_MS = 5 * 60 * 1000; // 5 minute deathmatch
export const MATCH_RESTART_MS = 14 * 1000;
export const RESPAWN_TIME_MS = 3200;
export const SPAWN_PROTECTION_MS = 2000;
export const BOT_FILL_TOTAL = 4; // room stays lively with up to 3 bots
export const BOT_DAMAGE_SCALE = 0.72; // aimbots track perfectly, so soften their hits
export const ROOM_LINGER_MS = 25 * 1000;
export const MAX_ROOMS = 300;

export const PLAYER_MAX_HEALTH = 100;
export const HEALTH_REGEN_DELAY_MS = 4800;
export const HEALTH_REGEN_PER_SEC = 14;

export const WALK_SPEED = 8.2;
export const SPRINT_SPEED = 11.6;
export const POSITION_TOLERANCE = 2.1; // multiplier on allowed distance per packet

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pulse Pistol',
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
    name: 'Nova Shotgun',
    short: 'SHOTGUN',
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
    name: 'Ion Rifle',
    short: 'RIFLE',
    damage: 13,
    headMultiplier: 2,
    fireDelay: 105,
    pellets: 1,
    spread: 0.02,
    range: 170,
    mag: 32,
    reloadMs: 1550,
    auto: true,
    color: '#c46bff',
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export const BOT_NAMES = [
  'NOVA',
  'GLITCH',
  'VOLT',
  'RIPTIDE',
  'ZAP',
  'CIPHER',
  'BLAZE',
  'ORBIT',
  'PIXEL',
  'QUASAR',
];
