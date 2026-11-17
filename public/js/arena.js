/**
 * NEON RIFT - shared arena definition & collision math.
 *
 * This module is intentionally free of DOM / Node specific APIs so the exact
 * same geometry is used by the authoritative server and the Three.js client.
 * Coordinates: X/Z are the ground plane, Y is up. One unit = one meter.
 */

export const ARENA_SIZE = 70; // floor is 70 x 70
export const ARENA_HALF = ARENA_SIZE / 2;
export const WALL_HEIGHT = 6.5;

export const SPAWNS = [
  { x: 0, z: -28.5 },
  { x: 19, z: -25 },
  { x: 28.5, z: -9 },
  { x: 28.5, z: 12 },
  { x: 16, z: 27.5 },
  { x: -16, z: 27.5 },
  { x: -28.5, z: 12 },
  { x: -28.5, z: -10 },
  { x: -19, z: -25 },
];

/**
 * Static arena geometry. `kind` drives the visual style on the client.
 * Outer walls are included so collision / raycasting is uniform.
 */
export const OBSTACLES = [
  // --- Outer boundary -------------------------------------------------
  { x: 0, z: -35.5, w: 73, d: 2, h: WALL_HEIGHT, kind: 'wall' },
  { x: 0, z: 35.5, w: 73, d: 2, h: WALL_HEIGHT, kind: 'wall' },
  { x: -35.5, z: 0, w: 2, d: 73, h: WALL_HEIGHT, kind: 'wall' },
  { x: 35.5, z: 0, w: 2, d: 73, h: WALL_HEIGHT, kind: 'wall' },

  // --- Central reactor tower -----------------------------------------
  { x: 0, z: 0, w: 7, d: 7, h: 4.6, kind: 'tower' },

  // --- Energy barriers ringing the center -----------------------------
  { x: 0, z: -13.5, w: 14, d: 1.3, h: 1.9, kind: 'barrier' },
  { x: 0, z: 13.5, w: 14, d: 1.3, h: 1.9, kind: 'barrier' },
  { x: -13.5, z: 0, w: 1.3, d: 14, h: 1.9, kind: 'barrier' },
  { x: 13.5, z: 0, w: 1.3, d: 14, h: 1.9, kind: 'barrier' },

  // --- Corner strongholds --------------------------------------------
  { x: -24, z: -24, w: 4.6, d: 4.6, h: 2.7, kind: 'crate' },
  { x: 24, z: -24, w: 4.6, d: 4.6, h: 2.7, kind: 'crate' },
  { x: -24, z: 24, w: 4.6, d: 4.6, h: 2.7, kind: 'crate' },
  { x: 24, z: 24, w: 4.6, d: 4.6, h: 2.7, kind: 'crate' },

  // --- Mid-field cover ------------------------------------------------
  { x: -20, z: -8, w: 3.4, d: 3.4, h: 2.3, kind: 'crate' },
  { x: 20, z: 8, w: 3.4, d: 3.4, h: 2.3, kind: 'crate' },
  { x: 8, z: -22, w: 3.6, d: 3.6, h: 2.4, kind: 'crate' },
  { x: -8, z: 22, w: 3.6, d: 3.6, h: 2.4, kind: 'crate' },
  { x: -6, z: -25.5, w: 6, d: 1.2, h: 1.3, kind: 'barrier' },
  { x: 6, z: 25.5, w: 6, d: 1.2, h: 1.3, kind: 'barrier' },
  { x: -26, z: 4, w: 1.2, d: 6, h: 1.3, kind: 'barrier' },
  { x: 26, z: -4, w: 1.2, d: 6, h: 1.3, kind: 'barrier' },

  // --- Neon pylons ----------------------------------------------------
  { x: -9, z: -28, w: 2, d: 2, h: 5.4, kind: 'pylon' },
  { x: 9, z: 28, w: 2, d: 2, h: 5.4, kind: 'pylon' },
  { x: 28, z: -24, w: 2, d: 2, h: 5.4, kind: 'pylon' },
  { x: -28, z: 24, w: 2, d: 2, h: 5.4, kind: 'pylon' },

  // --- Tall pillars ---------------------------------------------------
  { x: -9, z: 9, w: 1.8, d: 1.8, h: 5.6, kind: 'pillar' },
  { x: 9, z: -9, w: 1.8, d: 1.8, h: 5.6, kind: 'pillar' },
];

// Face the center of the arena from every spawn point.
export const SPAWN_YAW = SPAWNS.map((s) => Math.atan2(s.x, s.z));

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Push a circle (player) out of every solid obstacle.
 * Mutates and returns { x, z }.
 */
export function resolveCollision(x, z, radius, obstacles = OBSTACLES) {
  for (let pass = 0; pass < 3; pass++) {
    let resolved = false;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const minX = o.x - o.w / 2;
      const maxX = o.x + o.w / 2;
      const minZ = o.z - o.d / 2;
      const maxZ = o.z + o.d / 2;
      const nx = clamp(x, minX, maxX);
      const nz = clamp(z, minZ, maxZ);
      let dx = x - nx;
      let dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;

      resolved = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Center is inside the box: eject through the closest face.
        const left = x - minX;
        const right = maxX - x;
        const top = z - minZ;
        const bottom = maxZ - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = minX - radius;
        else if (m === right) x = maxX + radius;
        else if (m === top) z = minZ - radius;
        else z = maxZ + radius;
      }
    }
    if (!resolved) break;
  }

  // Hard safety clamp so nobody can ever leave the arena.
  const lim = ARENA_HALF - 1.6 - radius;
  x = clamp(x, -lim, lim);
  z = clamp(z, -lim, lim);
  return { x, z };
}

/**
 * Ray vs axis-aligned box (y from 0..o.h). Returns distance along the ray or
 * null. Direction must be normalized. Origin inside a box returns 0.
 */
export function rayHitsBox(ox, oy, oz, dx, dy, dz, o) {
  const minX = o.x - o.w / 2;
  const maxX = o.x + o.w / 2;
  const minY = 0;
  const maxY = o.h;
  const minZ = o.z - o.d / 2;
  const maxZ = o.z + o.d / 2;

  let tmin = 0;
  let tmax = Infinity;

  // X slab
  if (Math.abs(dx) < 1e-9) {
    if (ox < minX || ox > maxX) return null;
  } else {
    let t1 = (minX - ox) / dx;
    let t2 = (maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-9) {
    if (oy < minY || oy > maxY) return null;
  } else {
    let t1 = (minY - oy) / dy;
    let t2 = (maxY - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(dz) < 1e-9) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    let t1 = (minZ - oz) / dz;
    let t2 = (maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return tmin >= 0 ? tmin : null;
}

/** Nearest solid wall distance for a ray (used for bot line-of-sight). */
export function rayHitsArena(ox, oy, oz, dx, dy, dz) {
  let best = Infinity;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const t = rayHitsBox(ox, oy, oz, dx, dy, dz, OBSTACLES[i]);
    if (t !== null && t < best) best = t;
  }
  return best;
}

export const PLAYER_RADIUS = 0.48;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.58;

/** Ray vs. upright player cylinder. Returns { t, head } or null. */
export function rayHitsPlayer(ox, oy, oz, dx, dy, dz, p, maxDist = Infinity) {
  const cy = p.y ?? 0;
  const r = PLAYER_RADIUS + 0.06;

  // Solve XZ circle intersection.
  const px = ox - p.x;
  const pz = oz - p.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0 || t > maxDist) return null;

  const hitY = oy + dy * t;
  if (hitY < cy + 0.12 || hitY > cy + PLAYER_HEIGHT + 0.05) return null;
  return { t, head: hitY > cy + 1.44 };
}

export function spawnFacing(spawnIndex) {
  const s = SPAWNS[spawnIndex % SPAWNS.length];
  return { x: s.x, z: s.z, yaw: Math.atan2(-s.x, -s.z) };
}

/** Small deterministic-ish hash for decorative variation (client only). */
export function hashSeed(n) {
  let x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
