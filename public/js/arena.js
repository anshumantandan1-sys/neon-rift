/**
 * NEON RIFT — shared countryside arena definition & collision math.
 *
 * This module is intentionally free of DOM / Node specific APIs so the exact
 * same geometry is used by the authoritative server and the Three.js client.
 * Coordinates: X/Z are the ground plane, Y is up. One unit = one meter.
 */

export const ARENA_SIZE = 70; // fenced pasture is 70 x 70
export const ARENA_HALF = ARENA_SIZE / 2;
export const WALL_HEIGHT = 1.7;

/** Spawn points along the fence line, all facing the middle of the pasture. */
export const SPAWNS = [
  { x: 0, z: -31.5 },
  { x: 22, z: -29 },
  { x: 31, z: -8 },
  { x: 31, z: 12 },
  { x: 20, z: 30 },
  { x: -18, z: 30 },
  { x: -31, z: 14 },
  { x: -31, z: -10 },
  { x: -20, z: -30 },
  { x: 0, z: 31 },
];

/**
 * Static obstacles. `kind` drives the visual style on the client.
 * Every entry is an axis-aligned box used for collision and bullet rays.
 */
export const OBSTACLES = [
  // --- Boundary fence ---------------------------------------------------
  { x: 0, z: -35.3, w: 72, d: 1.0, h: WALL_HEIGHT, kind: 'fence' },
  { x: 0, z: 35.3, w: 72, d: 1.0, h: WALL_HEIGHT, kind: 'fence' },
  { x: -35.3, z: 0, w: 1.0, d: 72, h: WALL_HEIGHT, kind: 'fence' },
  { x: 35.3, z: 0, w: 1.0, d: 72, h: WALL_HEIGHT, kind: 'fence' },

  // --- Old stone ruin at the heart of the pasture -----------------------
  { x: 0, z: 0, w: 6, d: 6, h: 2.7, kind: 'ruin' },

  // --- Farm buildings ---------------------------------------------------
  { x: -22, z: -19, w: 12, d: 9, h: 5.6, kind: 'barn' },
  { x: -31, z: -21, w: 4, d: 4, h: 8.6, kind: 'silo' },
  { x: 25, z: -26, w: 3.2, d: 3.2, h: 9.4, kind: 'windmill' },

  // --- Hay, crates and troughs -----------------------------------------
  { x: -9, z: -8, w: 2.8, d: 1.8, h: 1.3, kind: 'hay' },
  { x: 10, z: 10, w: 2.8, d: 1.8, h: 1.3, kind: 'hay' },
  { x: -6, z: -25, w: 2.4, d: 1.7, h: 1.2, kind: 'hay' },
  { x: 7, z: 25, w: 2.6, d: 1.7, h: 1.2, kind: 'hay' },
  { x: -14, z: -12, w: 2.2, d: 2.2, h: 2.0, kind: 'crate' },
  { x: -16.6, z: -9.4, w: 1.7, d: 1.7, h: 1.5, kind: 'crate' },
  { x: 7, z: 18, w: 3, d: 1.2, h: 1.0, kind: 'trough' },

  // --- Dry stone walls --------------------------------------------------
  { x: -25, z: 2, w: 8, d: 1.0, h: 1.5, kind: 'stonewall' },
  { x: 24, z: 4, w: 1.0, d: 8, h: 1.5, kind: 'stonewall' },

  // --- Rocks ------------------------------------------------------------
  { x: 22, z: -18, w: 3, d: 3, h: 1.8, kind: 'rock' },
  { x: -24, z: 26, w: 2.4, d: 2.4, h: 1.6, kind: 'rock' },
  { x: 2, z: 22, w: 1.8, d: 1.8, h: 1.2, kind: 'rock' },

  // --- Oak trees (trunk collision only) --------------------------------
  { x: -12, z: 16, w: 1.0, d: 1.0, h: 3.4, kind: 'tree' },
  { x: 10, z: 16, w: 1.0, d: 1.0, h: 3.4, kind: 'tree' },
  { x: 18, z: -8, w: 1.0, d: 1.0, h: 3.4, kind: 'tree' },
  { x: -18, z: 8, w: 1.0, d: 1.0, h: 3.4, kind: 'tree' },
  { x: 6, z: -16, w: 1.0, d: 1.0, h: 3.4, kind: 'tree' },

  // --- Paddock fencing --------------------------------------------------
  { x: 28, z: 18, w: 10, d: 0.7, h: 1.2, kind: 'fence' },
  { x: -28, z: -2, w: 0.7, d: 10, h: 1.2, kind: 'fence' },
];

/** Open grazing spots for the animals. */
export const ANIMAL_SPAWNS = [
  { x: 11, z: 28 },
  { x: 12, z: 14 },
  { x: -6, z: 26 },
  { x: 27, z: 8 },
  { x: -26, z: 18 },
  { x: 4, z: -26 },
  { x: -10, z: -30 },
];

export const ANIMAL_SPECS = {
  deer: { radius: 0.55, height: 1.55 },
  bear: { radius: 0.72, height: 1.75 },
  chicken: { radius: 0.24, height: 0.55 },
};

// Face the center of the pasture from every spawn point.
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
      const dx = x - nx;
      const dz = z - nz;
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

  // Hard safety clamp so nobody can ever leave the pasture.
  const lim = ARENA_HALF - 1.6 - radius;
  x = clamp(x, -lim, lim);
  z = clamp(z, -lim, lim);
  return { x, z };
}

/** True when a circle at (x,z) does not overlap any solid box. */
export function isFreeSpot(x, z, radius = PLAYER_RADIUS) {
  for (const o of OBSTACLES) {
    const nx = clamp(x, o.x - o.w / 2, o.x + o.w / 2);
    const nz = clamp(z, o.z - o.d / 2, o.z + o.d / 2);
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < radius * radius) return false;
  }
  return Math.abs(x) < ARENA_HALF - 2 && Math.abs(z) < ARENA_HALF - 2;
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

/** Ray vs. a low animal capsule (cylinder approximation). */
export function rayHitsAnimal(ox, oy, oz, dx, dy, dz, animal, maxDist = Infinity) {
  const spec = ANIMAL_SPECS[animal.kind] || ANIMAL_SPECS.deer;
  const r = spec.radius + 0.05;
  const base = animal.y ?? 0;
  const top = base + spec.height;

  const px = ox - animal.x;
  const pz = oz - animal.z;
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
  if (hitY < base + 0.05 || hitY > top) return null;
  return { t };
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
