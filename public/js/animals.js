import * as THREE from 'three';

/**
 * Huntable countryside animals.
 *
 * The server owns their position, health and respawn timers; this module only
 * renders smooth low-poly models and animates walking, grazing and falling.
 */

const KIND_LABEL = { deer: 'DEER', bear: 'BEAR', chicken: 'CHICKEN' };
const KIND_TAG_HEIGHT = { deer: 2.35, bear: 2.45, chicken: 1.35 };

function angleTo(current, target, k) {
  let d = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * k;
}

function makeTagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { canvas, ctx, tex };
}

function boxMesh(w, h, d, x, y, z, material, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinderMesh(rTop, rBottom, h, x, y, z, material, parent, segments = 7) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildDeer(body) {
  const mats = [];
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...opts });
    mats.push(m);
    return m;
  };
  const fur = mat(0x9a6a3f);
  const furLight = mat(0xb98a58);
  const furDark = mat(0x6f4826);
  const belly = mat(0xd8c2a2);
  const hoof = mat(0x2a231b);
  const antler = mat(0xd8c9a8);
  const eye = mat(0x14100c, { roughness: 0.4 });

  boxMesh(0.62, 0.58, 1.22, 0, 0.94, 0.02, fur, body);
  boxMesh(0.66, 0.64, 0.5, 0, 0.96, -0.44, furLight, body);
  boxMesh(0.56, 0.54, 0.42, 0, 0.92, 0.5, fur, body);
  boxMesh(0.5, 0.2, 1.0, 0, 0.7, 0.02, belly, body);
  boxMesh(0.16, 0.2, 0.34, 0, 0.92, 0.78, mat(0xe7dcc8), body);

  // Neck.
  const neck = boxMesh(0.26, 0.6, 0.3, 0, 1.28, -0.68, furLight, body);
  neck.rotation.x = -0.34;

  const head = new THREE.Group();
  head.position.set(0, 1.56, -0.84);
  body.add(head);
  boxMesh(0.26, 0.26, 0.46, 0, 0, -0.08, furLight, head);
  boxMesh(0.17, 0.16, 0.24, 0, -0.06, -0.36, furDark, head);
  boxMesh(0.1, 0.03, 0.06, 0, -0.12, -0.47, hoof, head);
  for (const side of [-1, 1]) {
    const ear = boxMesh(0.05, 0.17, 0.1, side * 0.13, 0.16, -0.02, furDark, head);
    ear.rotation.z = side * 0.4;
    const eyeMesh = boxMesh(0.035, 0.045, 0.03, side * 0.1, 0.03, -0.3, eye, head);
    void eyeMesh;
    // Antlers: two little branching pairs.
    const beam = cylinderMesh(0.024, 0.03, 0.4, side * 0.09, 0.28, 0.02, antler, head, 5);
    beam.rotation.z = side * -0.35;
    beam.rotation.x = -0.2;
    const tine = cylinderMesh(0.018, 0.02, 0.22, side * 0.16, 0.44, -0.02, antler, head, 5);
    tine.rotation.z = side * -0.7;
    const tine2 = cylinderMesh(0.016, 0.018, 0.18, side * 0.06, 0.45, -0.04, antler, head, 5);
    tine2.rotation.z = side * 0.5;
  }

  const legs = [];
  for (const [lx, lz] of [
    [-0.21, -0.38],
    [0.21, -0.38],
    [-0.21, 0.46],
    [0.21, 0.46],
  ]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.74, lz);
    body.add(leg);
    boxMesh(0.12, 0.42, 0.14, 0, -0.21, 0, fur, leg);
    boxMesh(0.085, 0.36, 0.1, 0, -0.58, 0.01, furDark, leg);
    boxMesh(0.1, 0.08, 0.16, 0, -0.78, -0.02, hoof, leg);
    legs.push(leg);
  }

  return { head, legs, mats };
}

function buildBear(body) {
  const mats = [];
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...opts });
    mats.push(m);
    return m;
  };
  const fur = mat(0x5c3a22);
  const furLight = mat(0x7b5233);
  const furDark = mat(0x3f2715);
  const muzzle = mat(0xa07a4e);
  const nose = mat(0x14100c, { roughness: 0.45 });
  const claw = mat(0xd8c9a8);
  const eye = mat(0x0b0907, { roughness: 0.35 });

  // Bulky torso with the classic shoulder hump.
  boxMesh(1.0, 0.84, 1.62, 0, 1.08, 0.05, fur, body);
  boxMesh(0.88, 0.3, 1.18, 0, 0.72, 0.02, furDark, body);
  boxMesh(0.94, 0.42, 0.74, 0, 1.44, -0.42, furLight, body);
  boxMesh(0.86, 0.72, 0.5, 0, 1.1, 0.62, fur, body);
  boxMesh(0.72, 0.2, 1.3, 0, 1.52, 0.06, furLight, body);

  const head = new THREE.Group();
  head.position.set(0, 1.22, -0.95);
  body.add(head);
  boxMesh(0.6, 0.54, 0.56, 0, 0.02, -0.08, fur, head);
  boxMesh(0.34, 0.3, 0.3, 0, -0.12, -0.4, muzzle, head);
  boxMesh(0.2, 0.11, 0.09, 0, -0.08, -0.56, nose, head);
  boxMesh(0.26, 0.08, 0.22, 0, -0.27, -0.34, furDark, head);
  for (const side of [-1, 1]) {
    // Rounded ears.
    const ear = cylinderMesh(0.11, 0.11, 0.07, side * 0.24, 0.3, -0.02, furDark, head, 8);
    ear.rotation.x = Math.PI / 2;
    boxMesh(0.05, 0.05, 0.03, side * 0.15, 0.06, -0.33, eye, head);
    boxMesh(0.08, 0.04, 0.12, side * 0.15, 0.16, -0.3, furDark, head);
  }

  // Thick legs with broad paws and pale claws.
  const legs = [];
  for (const [lx, lz] of [
    [-0.34, -0.52],
    [0.34, -0.52],
    [-0.32, 0.56],
    [0.32, 0.56],
  ]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.86, lz);
    body.add(leg);
    boxMesh(0.26, 0.5, 0.3, 0, -0.23, 0, fur, leg);
    boxMesh(0.23, 0.38, 0.26, 0, -0.62, 0.01, furDark, leg);
    boxMesh(0.27, 0.14, 0.34, 0, -0.84, -0.03, furDark, leg);
    for (const c of [-1, 0, 1]) {
      boxMesh(0.04, 0.05, 0.1, c * 0.07, -0.93, -0.16, claw, leg);
    }
    legs.push(leg);
  }

  boxMesh(0.16, 0.2, 0.16, 0, 1.02, 0.92, furLight, body);

  return { head, legs, mats };
}

function buildChicken(body) {
  const mats = [];
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true, ...opts });
    mats.push(m);
    return m;
  };
  const feather = mat(0xf4eee1);
  const featherWarm = mat(0xd9b26f);
  const red = mat(0xd8422f);
  const beak = mat(0xe8a63d);
  const legMat = mat(0xc98a3a);
  const eye = mat(0x14100c, { roughness: 0.35 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), feather);
  torso.position.set(0, 0.42, 0.02);
  torso.scale.set(0.92, 1, 1.2);
  torso.castShadow = true;
  body.add(torso);

  const wingL = boxMesh(0.06, 0.2, 0.3, -0.25, 0.42, 0.02, featherWarm, body);
  wingL.rotation.z = 0.2;
  const wingR = boxMesh(0.06, 0.2, 0.3, 0.25, 0.42, 0.02, featherWarm, body);
  wingR.rotation.z = -0.2;

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 5), featherWarm);
  tail.position.set(0, 0.56, 0.34);
  tail.rotation.x = -0.85;
  tail.castShadow = true;
  body.add(tail);

  const head = new THREE.Group();
  head.position.set(0, 0.66, -0.2);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), feather);
  skull.castShadow = true;
  head.add(skull);
  const comb = boxMesh(0.05, 0.13, 0.16, 0, 0.17, 0, red, head);
  comb.rotation.z = 0.05;
  const wattle = boxMesh(0.05, 0.1, 0.05, 0, -0.14, -0.11, red, head);
  wattle.rotation.x = 0.2;
  const beakMesh = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), beak);
  beakMesh.position.set(0, 0, -0.2);
  beakMesh.rotation.x = -Math.PI / 2;
  head.add(beakMesh);
  for (const side of [-1, 1]) {
    boxMesh(0.035, 0.045, 0.03, side * 0.1, 0.03, -0.11, eye, head);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, 0.3, 0.02);
    body.add(leg);
    cylinderMesh(0.025, 0.03, 0.22, 0, -0.11, 0, legMat, leg, 5);
    boxMesh(0.1, 0.03, 0.06, 0, -0.23, -0.03, legMat, leg);
    legs.push(leg);
  }

  return { head, legs, mats };
}

const BUILDERS = { deer: buildDeer, bear: buildBear, chicken: buildChicken };

class AnimalAvatar {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.kind = data.kind || 'deer';
    this.target = {
      x: data.x ?? 0,
      y: data.y ?? 0,
      z: data.z ?? 0,
      yaw: data.yaw ?? 0,
      health: data.health ?? 1,
      maxHealth: data.maxHealth ?? data.health ?? 1,
      alive: data.alive !== false,
      kind: this.kind,
    };
    this.initialized = false;
    this.wasAlive = this.target.alive;
    this.walkPhase = Math.random() * 7;
    this.flashT = 0;
    this.fallT = 0;
    this.fallDir = 1;
    this.grazeTimer = 1 + Math.random() * 3;
    this.grazing = false;
    this.lastHealth = this.target.health;
    this.disposed = false;

    this.root = new THREE.Group();
    this.root.name = `animal_${this.id}`;
    scene.add(this.root);

    this.body = new THREE.Group();
    this.root.add(this.body);

    const builder = BUILDERS[this.kind] || BUILDERS.deer;
    const built = builder(this.body);
    this.head = built.head;
    this.legs = built.legs;
    this.mats = built.mats;
    this.mats.forEach((m) => {
      if (m.emissive) m.emissive.setRGB(0, 0, 0);
    });

    const { canvas, ctx, tex } = makeTagTexture();
    this.tag = { canvas, ctx, tex };
    this.tagSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }),
    );
    this.tagSprite.scale.set(1.5, 0.56, 1);
    this.tagSprite.position.y = KIND_TAG_HEIGHT[this.kind] || 2.2;
    this.root.add(this.tagSprite);
    this.refreshTag();
  }

  refreshTag() {
    const { canvas, ctx, tex } = this.tag;
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 26px "Segoe UI", Arial, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#f7ecd6';
    ctx.fillText(KIND_LABEL[this.kind] || 'ANIMAL', w / 2, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(12, 16, 10, 0.72)';
    ctx.fillRect(28, 52, w - 56, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 52, w - 56, 16);
    const ratio = this.target.maxHealth > 0 ? Math.max(0, Math.min(1, this.target.health / this.target.maxHealth)) : 0;
    ctx.fillStyle = ratio > 0.55 ? '#9be86b' : ratio > 0.25 ? '#ffc247' : '#ff6b6b';
    ctx.fillRect(30, 54, (w - 60) * ratio, 12);
    tex.needsUpdate = true;
    void h;
  }

  setTarget(p) {
    if (!p) return;
    const wasAlive = this.target.alive;
    if (p.kind && p.kind !== this.kind) return;
    this.target = {
      x: p.x,
      y: p.y ?? 0,
      z: p.z,
      yaw: p.yaw ?? 0,
      health: p.health ?? 0,
      maxHealth: this.target.maxHealth,
      alive: p.alive !== false,
      kind: this.kind,
    };
    if (this.target.health !== this.lastHealth) {
      this.lastHealth = this.target.health;
      this.refreshTag();
    }
    if (!this.initialized) {
      this.initialized = true;
      this.root.position.set(p.x, p.y ?? 0, p.z);
      this.root.rotation.y = p.yaw ?? 0;
    }
    if (this.target.alive && !wasAlive) {
      // Respawned: stand back up.
      this.root.position.set(p.x, p.y ?? 0, p.z);
      this.root.rotation.y = p.yaw ?? 0;
      this.body.rotation.set(0, 0, 0);
      this.body.position.y = 0;
      this.fallT = 0;
      this.tagSprite.visible = true;
      this.root.visible = true;
      this.lastHealth = -1;
      this.refreshTag();
    }
    if (!this.target.alive && wasAlive) {
      this.fallT = 0.0001;
      this.fallDir = Math.random() > 0.5 ? 1 : -1;
    }
    this.wasAlive = this.target.alive;
  }

  flash() {
    this.flashT = 0.18;
  }

  markDead() {
    if (this.target.alive) {
      this.target.alive = false;
      this.wasAlive = true;
      this.fallT = 0.0001;
      this.fallDir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  update(dt, time) {
    if (this.disposed) return;
    const t = this.target;

    if (!t.alive) {
      this.fallT = Math.min(2.2, this.fallT + dt);
      const k = Math.min(1, this.fallT / 0.65);
      const eased = 1 - Math.pow(1 - k, 3);
      this.body.rotation.z = eased * (Math.PI / 2 - 0.04) * this.fallDir;
      this.body.rotation.x = eased * 0.08;
      this.body.position.y = Math.sin(Math.min(1, this.fallT / 0.9) * Math.PI) * 0.05;
      this.tagSprite.visible = this.fallT < 0.3;
      this.legs.forEach((leg, i) => {
        leg.rotation.x = eased * (i % 2 === 0 ? 0.4 : -0.3);
      });
      return;
    }

    this.tagSprite.visible = true;
    const k = 1 - Math.exp(-dt * 9);
    const prevX = this.root.position.x;
    const prevZ = this.root.position.z;
    this.root.position.x += (t.x - this.root.position.x) * k;
    this.root.position.z += (t.z - this.root.position.z) * k;
    this.root.position.y += ((t.y ?? 0) - this.root.position.y) * k;
    this.root.rotation.y = angleTo(this.root.rotation.y, t.yaw ?? 0, 1 - Math.exp(-dt * 7));

    const speed = dt > 0 ? Math.hypot(this.root.position.x - prevX, this.root.position.z - prevZ) / dt : 0;
    const moving = speed > 0.25;

    // Idle grazing: head dips toward the grass now and then.
    this.grazeTimer -= dt;
    if (this.grazeTimer <= 0) {
      this.grazing = !this.grazing;
      this.grazeTimer = this.grazing ? 1.6 + Math.random() * 2.4 : 2 + Math.random() * 3.5;
    }
    const targetHead = moving ? 0.05 : this.grazing ? 0.55 : 0.12;
    this.head.rotation.x += (targetHead + Math.sin(time * 1.8 + this.walkPhase) * 0.03 - this.head.rotation.x) * Math.min(1, dt * 4);

    this.walkPhase += dt * (moving ? 7.5 : 1.6);
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : Math.sin(this.walkPhase) * 0.03;
    const stride = this.kind === 'chicken' ? 0.9 : 0.55;
    this.legs.forEach((leg, i) => {
      const phase = i === 0 || i === 3 ? 1 : -1;
      leg.rotation.x = swing * stride * phase;
    });
    this.body.position.y = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.03 : 0;
    if (this.kind === 'chicken') {
      this.body.rotation.z = moving ? Math.sin(this.walkPhase * 2) * 0.06 : 0;
    }

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      const f = this.flashT / 0.18;
      for (const m of this.mats) {
        if (m.emissive) m.emissive.setRGB(f * 1.6, f * 0.8, f * 0.5);
      }
    } else {
      for (const m of this.mats) {
        if (m.emissive) m.emissive.setRGB(0, 0, 0);
      }
    }

    this.tagSprite.position.y = (KIND_TAG_HEIGHT[this.kind] || 2.2) + Math.sin(time * 1.6 + this.walkPhase) * 0.03;
  }

  dispose() {
    this.disposed = true;
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      }
    });
    this.tag.tex?.dispose();
  }
}

/** Keeps every animal avatar in sync with server snapshots. */
export class AnimalField {
  constructor(scene) {
    this.scene = scene;
    this.animals = new Map();
  }

  applySnapshot(list = []) {
    const seen = new Set();
    for (const data of list) {
      if (!data || !data.id) continue;
      seen.add(data.id);
      let animal = this.animals.get(data.id);
      if (!animal) {
        animal = new AnimalAvatar(this.scene, data);
        this.animals.set(data.id, animal);
      }
      animal.setTarget(data);
    }
    for (const [id, animal] of this.animals) {
      if (!seen.has(id)) {
        animal.dispose();
        this.animals.delete(id);
      }
    }
  }

  get(id) {
    return this.animals.get(id);
  }

  flash(id) {
    this.animals.get(id)?.flash();
  }

  kill(id) {
    this.animals.get(id)?.markDead();
  }

  /** Live targets for local bullet prediction. */
  list() {
    const out = [];
    for (const a of this.animals.values()) {
      if (a.target.alive) out.push(a.target);
    }
    return out;
  }

  update(dt, time) {
    for (const a of this.animals.values()) a.update(dt, time);
  }

  dispose() {
    for (const a of this.animals.values()) a.dispose();
    this.animals.clear();
  }
}
