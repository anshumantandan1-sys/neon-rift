import * as THREE from 'three';

/**
 * Client-side weapon data. Fire-rate / magazine values mirror the server,
 * while the extra fields drive the feel: recoil, crosshair, viewmodel art.
 */
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Vanguard Pistol',
    slot: 1,
    auto: false,
    damage: 23,
    fireDelay: 145,
    mag: 14,
    reloadMs: 1050,
    spread: 0.008,
    pellets: 1,
    range: 130,
    color: '#4de3ff',
    crosshair: 'pistol',
    recoilPitch: 0.016,
    recoilYaw: 0.005,
    kick: 0.09,
    shake: 0.12,
    fovKick: 0.4,
    sound: 'pistol',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Ranch Sweeper',
    slot: 2,
    auto: false,
    damage: 11,
    fireDelay: 860,
    mag: 6,
    reloadMs: 1850,
    spread: 0.07,
    pellets: 9,
    range: 46,
    color: '#ff8a3d',
    crosshair: 'shotgun',
    recoilPitch: 0.055,
    recoilYaw: 0.02,
    kick: 0.22,
    shake: 0.5,
    fovKick: 2.2,
    sound: 'shotgun',
  },
  rifle: {
    id: 'rifle',
    name: 'Ranger Rifle',
    slot: 3,
    auto: true,
    damage: 13,
    fireDelay: 105,
    mag: 32,
    reloadMs: 1550,
    spread: 0.02,
    pellets: 1,
    range: 170,
    color: '#8dff6b',
    crosshair: 'rifle',
    recoilPitch: 0.011,
    recoilYaw: 0.007,
    kick: 0.07,
    shake: 0.16,
    fovKick: 0.6,
    sound: 'rifle',
  },
  smg: {
    id: 'smg',
    name: 'Hornet SMG',
    slot: 4,
    auto: true,
    damage: 9,
    fireDelay: 78,
    mag: 40,
    reloadMs: 1350,
    spread: 0.03,
    pellets: 1,
    range: 110,
    color: '#ffd24a',
    crosshair: 'smg',
    recoilPitch: 0.008,
    recoilYaw: 0.009,
    kick: 0.055,
    shake: 0.13,
    fovKick: 0.45,
    sound: 'smg',
  },
  dmr: {
    id: 'dmr',
    name: 'Longshot DMR',
    slot: 5,
    auto: false,
    damage: 36,
    fireDelay: 430,
    mag: 8,
    reloadMs: 1750,
    spread: 0.003,
    pellets: 1,
    range: 240,
    color: '#7df3ff',
    crosshair: 'dmr',
    recoilPitch: 0.038,
    recoilYaw: 0.006,
    kick: 0.18,
    shake: 0.32,
    fovKick: 1.4,
    sound: 'dmr',
  },
};

export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'smg', 'dmr'];

function cylinderBetween(a, b, radius, material, radialSegments = 8) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function makeArmRig(accent, hands) {
  const rig = new THREE.Group();
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x555f3e, roughness: 0.92 });
  const sleeveDark = new THREE.MeshStandardMaterial({ color: 0x363d2b, roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.78, metalness: 0.08 });
  const glovePad = new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: 0.7 });
  const strap = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, metalness: 0.2 });

  const elbowR = [0.66, -1.02, 0.02];
  const elbowL = [-0.16, -1.04, -0.08];

  const addForearm = (elbow, hand, side) => {
    const upper = cylinderBetween(elbow, hand, 0.082, sleeve, 8);
    rig.add(upper);
    const cuff = cylinderBetween(
      [hand[0] + (elbow[0] - hand[0]) * 0.1, hand[1] + (elbow[1] - hand[1]) * 0.1, hand[2] + (elbow[2] - hand[2]) * 0.1],
      [hand[0] + (elbow[0] - hand[0]) * 0.22, hand[1] + (elbow[1] - hand[1]) * 0.22, hand[2] + (elbow[2] - hand[2]) * 0.22],
      0.094,
      sleeveDark,
      8,
    );
    rig.add(cuff);

    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.15), glove);
    fist.position.set(hand[0], hand[1], hand[2]);
    fist.rotation.set(0.18, side * 0.16, side * 0.08);
    rig.add(fist);

    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.05, 0.135), glovePad);
    knuckles.position.set(hand[0] + side * 0.012, hand[1] + 0.07, hand[2] - 0.005);
    knuckles.rotation.copy(fist.rotation);
    rig.add(knuckles);

    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.045, 0.16), strap);
    wrist.position.set(hand[0] - side * 0.01, hand[1] - 0.075, hand[2] + 0.01);
    wrist.rotation.copy(fist.rotation);
    rig.add(wrist);
  };

  addForearm(elbowR, hands.right, 1);
  addForearm(elbowL, hands.left, -1);

  // Partial torso so the player sees they are a person, not a floating gun.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.46), sleeve);
  torso.position.set(0.1, -1.18, 0.02);
  torso.rotation.x = -0.12;
  rig.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.08), sleeveDark);
  vest.position.set(0.1, -1.12, -0.2);
  vest.rotation.x = -0.12;
  rig.add(vest);

  for (const side of [-1, 1]) {
    const strapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.03), strap);
    strapMesh.position.set(0.1 + side * 0.2, -1.1, -0.25);
    strapMesh.rotation.set(-0.12, 0, side * 0.16);
    rig.add(strapMesh);
  }

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.34), sleeveDark);
  collar.position.set(0.1, -0.9, -0.02);
  rig.add(collar);

  return rig;
}

export function createViewmodel(id) {
  const def = WEAPONS[id] || WEAPONS.rifle;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.set(0.23, -0.15, -0.3);
  inner.rotation.set(0, 0.08, 0.015);
  inner.scale.setScalar(0.86);
  group.add(inner);

  const accent = new THREE.Color(def.color);
  const metal = new THREE.MeshStandardMaterial({ color: 0x343d46, metalness: 0.72, roughness: 0.36 });
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x20262c, metalness: 0.65, roughness: 0.44 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x3f4636, metalness: 0.12, roughness: 0.78 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x74492c, metalness: 0.05, roughness: 0.82 });
  const glow = new THREE.MeshBasicMaterial({ color: accent });
  const lens = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff,
    emissive: new THREE.Color(def.color),
    emissiveIntensity: 1.8,
    metalness: 0.2,
    roughness: 0.15,
  });

  const muzzle = new THREE.Object3D();

  const addBox = (w, h, d, x, y, z, mat, parent = inner) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const addCylinder = (r, len, x, y, z, mat, axis = 'z', segments = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), mat);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    inner.add(mesh);
    return mesh;
  };

  let hands = {
    right: [0.24, -0.34, -0.55],
    left: [0.16, -0.3, -0.86],
  };

  if (id === 'pistol') {
    addBox(0.12, 0.14, 0.5, 0, -0.03, -0.56, metal);
    addBox(0.105, 0.05, 0.46, 0, 0.045, -0.55, metalDark);
    addCylinder(0.032, 0.16, 0, -0.01, -0.83, metalDark);
    addBox(0.1, 0.2, 0.14, 0, -0.19, -0.4, polymer).rotation.x = -0.2;
    addBox(0.085, 0.13, 0.1, 0, -0.29, -0.37, metalDark).rotation.x = -0.2;
    addBox(0.026, 0.028, 0.4, 0.045, 0.055, -0.55, glow);
    addBox(0.018, 0.035, 0.02, 0, 0.095, -0.75, glow);
    addBox(0.02, 0.035, 0.02, 0, 0.095, -0.36, glow);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 12, Math.PI), metalDark);
    guard.position.set(0, -0.12, -0.47);
    guard.rotation.set(Math.PI / 2, 0, Math.PI);
    inner.add(guard);
    muzzle.position.set(0, -0.01, -0.92);
    hands = { right: [0.25, -0.35, -0.56], left: [0.12, -0.31, -0.52] };
  } else if (id === 'shotgun') {
    addBox(0.16, 0.2, 0.5, 0, -0.1, -0.56, metal);
    addCylinder(0.045, 0.86, 0, 0.01, -0.98, metalDark);
    addCylinder(0.036, 0.7, 0, -0.08, -0.92, metal);
    addBox(0.13, 0.12, 0.26, 0, -0.08, -0.74, wood);
    addBox(0.12, 0.15, 0.4, 0, -0.16, -0.22, wood).rotation.x = 0.08;
    addBox(0.1, 0.12, 0.22, 0, -0.28, -0.46, wood).rotation.x = -0.28;
    addBox(0.03, 0.03, 0.28, 0, -0.02, -0.4, glow);
    addBox(0.012, 0.03, 0.012, 0, 0.065, -1.34, glow);
    addBox(0.11, 0.03, 0.3, 0, 0.085, -0.9, metalDark);
    muzzle.position.set(0, 0.01, -1.42);
    hands = { right: [0.24, -0.34, -0.5], left: [0.2, -0.28, -0.82] };
  } else if (id === 'rifle') {
    addBox(0.16, 0.2, 0.52, 0, -0.04, -0.52, metal);
    addBox(0.13, 0.13, 0.48, 0, -0.015, -0.98, polymer);
    addCylinder(0.026, 0.36, 0, -0.015, -1.34, metalDark);
    addBox(0.11, 0.16, 0.36, 0, -0.09, -0.18, polymer);
    addBox(0.13, 0.09, 0.2, 0, 0.06, -0.16, polymer);
    addBox(0.1, 0.2, 0.15, 0, -0.2, -0.4, polymer).rotation.x = -0.18;
    addBox(0.1, 0.16, 0.16, 0, -0.2, -0.6, metalDark).rotation.x = 0.12;
    addBox(0.11, 0.045, 0.42, 0, 0.075, -0.55, metalDark);
    // Red dot sight.
    addBox(0.07, 0.06, 0.12, 0, 0.11, -0.56, metalDark);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 6, 16), metalDark);
    ring.position.set(0, 0.17, -0.58);
    ring.rotation.y = Math.PI / 2;
    inner.add(ring);
    addBox(0.05, 0.05, 0.012, 0, 0.17, -0.58, lens);
    addBox(0.028, 0.02, 0.4, 0.055, 0.005, -0.9, glow);
    muzzle.position.set(0, -0.015, -1.55);
    hands = { right: [0.25, -0.35, -0.53], left: [0.18, -0.29, -0.94] };
  } else if (id === 'smg') {
    addBox(0.15, 0.17, 0.42, 0, -0.03, -0.46, metal);
    addBox(0.1, 0.1, 0.3, 0, -0.02, -0.78, polymer);
    addCylinder(0.052, 0.3, 0, -0.02, -0.98, metalDark);
    addCylinder(0.062, 0.22, 0, -0.02, -1.16, metalDark);
    addBox(0.1, 0.26, 0.13, 0, -0.24, -0.48, metalDark).rotation.x = -0.06;
    addBox(0.09, 0.15, 0.14, 0, -0.18, -0.32, polymer).rotation.x = -0.22;
    addBox(0.03, 0.4, 0.05, -0.1, -0.03, -0.42, metalDark).rotation.z = 0.12;
    addBox(0.09, 0.04, 0.34, 0, 0.085, -0.5, metalDark);
    addBox(0.02, 0.02, 0.34, 0.036, 0.09, -0.5, glow);
    addBox(0.085, 0.06, 0.02, 0, 0.13, -0.34, glow);
    muzzle.position.set(0, -0.02, -1.3);
    hands = { right: [0.245, -0.35, -0.5], left: [0.17, -0.29, -0.8] };
  } else {
    // Longshot DMR.
    addBox(0.15, 0.18, 0.5, 0, -0.03, -0.48, metal);
    addBox(0.12, 0.12, 0.44, 0, -0.02, -0.9, polymer);
    addCylinder(0.024, 0.62, 0, -0.02, -1.36, metalDark);
    addCylinder(0.036, 0.12, 0, -0.02, -1.67, metalDark);
    addBox(0.12, 0.18, 0.42, 0, -0.11, -0.12, wood).rotation.x = 0.06;
    addBox(0.1, 0.16, 0.14, 0, 0.0, -0.14, wood);
    addBox(0.1, 0.14, 0.14, 0, -0.18, -0.36, polymer).rotation.x = -0.2;
    addBox(0.09, 0.14, 0.15, 0, -0.16, -0.56, metalDark).rotation.x = 0.1;
    // Scope.
    addCylinder(0.055, 0.34, 0, 0.14, -0.62, metalDark);
    addCylinder(0.068, 0.05, 0, 0.14, -0.79, metalDark);
    addCylinder(0.05, 0.012, 0, 0.14, -0.79, lens);
    addBox(0.03, 0.07, 0.1, 0, 0.09, -0.5, metalDark);
    addBox(0.03, 0.07, 0.1, 0, 0.09, -0.72, metalDark);
    // Bipod.
    for (const side of [-1, 1]) {
      const leg = cylinderBetween([0, -0.05, -1.3], [side * 0.18, -0.42, -1.42], 0.012, metalDark, 5);
      inner.add(leg);
    }
    addBox(0.02, 0.02, 0.5, 0.052, 0.015, -0.9, glow);
    muzzle.position.set(0, -0.02, -1.75);
    hands = { right: [0.245, -0.35, -0.5], left: [0.17, -0.28, -1.02] };
  }

  group.add(makeArmRig(accent, hands));

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 5;
    }
  });

  if (id === 'shotgun') {
    inner.scale.multiplyScalar(0.92);
    inner.position.z -= 0.04;
  }
  if (id === 'dmr') {
    inner.position.y -= 0.01;
  }

  inner.add(muzzle);
  return { group, muzzle, def, inner };
}
