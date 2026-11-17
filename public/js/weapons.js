import * as THREE from 'three';

/**
 * Client-side weapon data. Fire-rate / magazine values mirror the server,
 * while the extra fields drive the feel: recoil, crosshair, viewmodel art.
 */
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pulse Pistol',
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
    name: 'Nova Shotgun',
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
    name: 'Ion Rifle',
    slot: 3,
    auto: true,
    damage: 13,
    fireDelay: 105,
    mag: 32,
    reloadMs: 1550,
    spread: 0.02,
    pellets: 1,
    range: 170,
    color: '#c46bff',
    crosshair: 'rifle',
    recoilPitch: 0.011,
    recoilYaw: 0.007,
    kick: 0.07,
    shake: 0.16,
    fovKick: 0.6,
    sound: 'rifle',
  },
};

export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle'];

export function createViewmodel(id) {
  const def = WEAPONS[id] || WEAPONS.rifle;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  // Frame the weapon low and to the right, angled slightly across the view.
  inner.position.set(0.24, -0.12, -0.22);
  inner.rotation.set(0, 0.1, 0.02);
  inner.scale.setScalar(0.72);
  group.add(inner);
  const accent = new THREE.Color(def.color);
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3856, metalness: 0.3, roughness: 0.46 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x4a5b82, metalness: 0.25, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: accent });
  const muzzle = new THREE.Object3D();

  const addBox = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    inner.add(mesh);
    return mesh;
  };

  if (id === 'pistol') {
    addBox(0.11, 0.15, 0.46, 0.2, -0.16, -0.62, dark);
    addBox(0.085, 0.045, 0.32, 0.2, -0.07, -0.68, mid);
    addBox(0.075, 0.16, 0.11, 0.2, -0.27, -0.48, mid);
    addBox(0.05, 0.06, 0.2, 0.2, -0.1, -0.78, glow);
    addBox(0.04, 0.04, 0.12, 0.2, -0.26, -0.53, glow);
    muzzle.position.set(0.2, -0.08, -0.87);
  } else if (id === 'shotgun') {
    addBox(0.16, 0.17, 0.78, 0.19, -0.17, -0.62, dark);
    addBox(0.1, 0.1, 0.55, 0.19, -0.055, -0.78, mid);
    addBox(0.07, 0.07, 0.4, 0.19, -0.055, -0.95, glow);
    addBox(0.13, 0.14, 0.24, 0.19, -0.24, -0.37, mid);
    addBox(0.15, 0.05, 0.3, 0.19, -0.25, -0.56, glow);
    addBox(0.05, 0.12, 0.1, 0.19, -0.3, -0.42, dark);
    muzzle.position.set(0.19, -0.055, -1.16);
  } else {
    // Receiver and stock.
    addBox(0.16, 0.2, 0.55, 0.2, -0.16, -0.58, dark);
    addBox(0.12, 0.14, 0.2, 0.2, -0.18, -0.24, dark);
    // Upper rail + barrel shroud.
    addBox(0.1, 0.06, 0.42, 0.2, -0.035, -0.62, mid);
    addBox(0.09, 0.09, 0.4, 0.2, -0.1, -0.98, mid);
    addBox(0.06, 0.06, 0.16, 0.2, -0.1, -1.24, dark);
    // Grip and magazine.
    addBox(0.09, 0.18, 0.13, 0.2, -0.31, -0.38, dark);
    addBox(0.08, 0.15, 0.18, 0.2, -0.32, -0.62, mid);
    // Neon accents (kept slim so the silhouette stays readable).
    addBox(0.03, 0.02, 0.32, 0.2, -0.002, -0.62, glow);
    addBox(0.02, 0.06, 0.26, 0.121, -0.16, -0.6, glow);
    addBox(0.055, 0.055, 0.05, 0.2, -0.1, -1.33, glow);
    muzzle.position.set(0.2, -0.1, -1.36);
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 5;
    }
  });

  // Per-weapon framing so each model keeps a similar on-screen footprint.
  if (id === 'shotgun') {
    inner.scale.multiplyScalar(0.82);
    inner.position.z -= 0.14;
  }

  group.position.set(0, 0, 0);
  inner.add(muzzle);
  return { group, muzzle, def, inner };
}
