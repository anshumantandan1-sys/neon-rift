import * as THREE from 'three';

const MAX_PARTICLES = 1100;
const MAX_TRACERS = 64;
const MAX_FLASHES = 24;
const MAX_RINGS = 16;

function vec3(v) {
  return v instanceof THREE.Vector3 ? v : new THREE.Vector3(v.x, v.y, v.z);
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);
    this.glowTexture = makeGlowTexture();
    this.time = 0;
    this.pointer = 0;
    this.tracers = [];
    this.flashes = [];
    this.rings = [];
    this.buildParticles();
    this.buildPools();
  }

  buildParticles() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.parts = new Array(MAX_PARTICLES).fill(null).map(() => ({
      active: false,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 9,
      drag: 1.5,
      startSize: 0.1,
    }));
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 250);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (320.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.group.add(this.points);
  }

  buildPools() {
    const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < MAX_TRACERS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.group.add(mesh);
      this.tracers.push({ mesh, mat, life: 0, maxLife: 0.1 });
    }

    for (let i = 0; i < MAX_FLASHES; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 9;
      this.group.add(sprite);
      this.flashes.push({ sprite, mat, life: 0, maxLife: 0.08 });
    }

    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, life: 0, maxLife: 0.5, radius: 1 });
    }
  }

  spawnParticle(x, y, z, color, opts = {}) {
    for (let n = 0; n < MAX_PARTICLES; n++) {
      const i = (this.pointer + n) % MAX_PARTICLES;
      const p = this.parts[i];
      if (p.active) continue;
      this.pointer = (i + 1) % MAX_PARTICLES;
      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.2) * Math.PI;
      const speed = (opts.speed ?? 4) * (0.35 + Math.random() * 0.9);
      p.active = true;
      p.life = p.maxLife = (opts.life ?? 0.5) * (0.6 + Math.random() * 0.7);
      p.vx = Math.cos(angle) * Math.cos(elev) * speed + (opts.vx ?? 0);
      p.vy = Math.sin(elev) * speed + (opts.vy ?? 1.5);
      p.vz = Math.sin(angle) * Math.cos(elev) * speed + (opts.vz ?? 0);
      p.gravity = opts.gravity ?? 12;
      p.drag = opts.drag ?? 1.4;
      p.startSize = (opts.size ?? 0.08) * (0.6 + Math.random() * 0.9);
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;
      this.sizes[i] = p.startSize;
      this.alphas[i] = 1;
      return;
    }
  }

  spawnTracer(fromRaw, toRaw, colorHex, width = 0.045, life = 0.1) {
    const from = vec3(fromRaw);
    const to = vec3(toRaw);
    const len = from.distanceTo(to);
    if (len < 0.05) return;
    let slot = this.tracers.find((t) => t.life <= 0);
    if (!slot) slot = this.tracers[0];
    slot.life = slot.maxLife = life;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    slot.mesh.lookAt(to);
    slot.mesh.scale.set(width, width, len);
    slot.mat.color.set(colorHex);
    slot.mat.opacity = 0.95;
  }

  spawnMuzzleFlash(pointRaw, colorHex, scale = 0.7) {
    const point = vec3(pointRaw);
    let slot = this.flashes.find((f) => f.life <= 0);
    if (!slot) slot = this.flashes[0];
    slot.life = slot.maxLife = 0.07;
    slot.sprite.visible = true;
    slot.sprite.position.copy(point);
    slot.sprite.scale.setScalar(scale);
    slot.sprite.material.rotation = Math.random() * Math.PI;
    slot.mat.color.set(colorHex);
    slot.mat.opacity = 1;
    for (let i = 0; i < 3; i++) {
      this.spawnParticle(point.x, point.y, point.z, new THREE.Color(colorHex), {
        speed: 3,
        life: 0.12,
        size: 0.05,
        gravity: 0,
        vy: 0,
      });
    }
  }

  spawnImpact(pointRaw, colorHex, count = 14) {
    const point = vec3(pointRaw);
    const color = new THREE.Color(colorHex);
    this.spawnMuzzleFlash(point, colorHex, 0.5);
    for (let i = 0; i < count; i++) {
      this.spawnParticle(point.x, point.y, point.z, color, {
        speed: 5.5,
        life: 0.4,
        size: 0.07,
        gravity: 14,
      });
    }
  }

  spawnKillBurst(pointRaw, colorHex) {
    const point = vec3(pointRaw);
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < 55; i++) {
      this.spawnParticle(point.x, point.y, point.z, color, {
        speed: 9,
        life: 0.9,
        size: 0.12,
        gravity: 8,
        drag: 0.8,
        vy: Math.random() * 4,
      });
    }
    this.spawnMuzzleFlash(point, colorHex, 2.4);
    this.spawnRing(point, colorHex, 3.2);
  }

  spawnRing(pointRaw, colorHex, radius = 2, life = 0.55) {
    const point = vec3(pointRaw);
    let slot = this.rings.find((r) => r.life <= 0);
    if (!slot) slot = this.rings[0];
    slot.mesh.visible = true;
    slot.mesh.position.set(point.x, 0.06 + point.y * 0.05, point.z);
    slot.mat.color.set(colorHex);
    slot.mat.opacity = 0.9;
    slot.life = slot.maxLife = life;
    slot.radius = radius;
    slot.mesh.scale.setScalar(0.2);
  }

  update(dt) {
    this.time += dt;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.parts[i];
      if (!p.active) {
        if (this.alphas[i] !== 0) this.alphas[i] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - p.gravity * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      if (this.positions[i * 3 + 1] < 0.03) {
        this.positions[i * 3 + 1] = 0.03;
        p.vy = Math.abs(p.vy) * 0.28;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      const t = p.life / p.maxLife;
      this.alphas[i] = Math.min(1, t * 1.8);
      this.sizes[i] = p.startSize * (0.5 + t * 0.9);
    }

    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;

    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const k = Math.max(0, t.life / t.maxLife);
      t.mat.opacity = k * 0.95;
      if (t.life <= 0) t.mesh.visible = false;
    }

    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life / f.maxLife);
      f.mat.opacity = k;
      f.sprite.scale.setScalar(Math.max(0.05, f.sprite.scale.x) * (1 + dt * 2));
      if (f.life <= 0) f.sprite.visible = false;
    }

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = Math.max(0, r.life / r.maxLife);
      const grow = 1 - k;
      r.mesh.scale.setScalar(0.2 + grow * r.radius);
      r.mat.opacity = k * 0.8;
      if (r.life <= 0) r.mesh.visible = false;
    }
  }
}
