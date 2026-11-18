import * as THREE from 'three';
import { EYE_HEIGHT, PLAYER_RADIUS, resolveCollision } from './arena.js';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'];

/** Keyboard + mouse state. Mouse deltas only accumulate while pointer-locked. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.fireHeld = false;
    this.firePressed = false;
    this.locked = false;
    this.sensitivity = 1;
    this.enabled = true;
    this.onLockChange = null;

    this.handleKeyDown = (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.enabled) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this.handleKeyUp = (e) => this.keys.delete(e.code);
    this.handleMouseDown = (e) => {
      if (e.button === 0) {
        if (!this.fireHeld) this.firePressed = true;
        this.fireHeld = true;
      }
    };
    this.handleMouseUp = (e) => {
      if (e.button === 0) this.fireHeld = false;
    };
    this.handleMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this.handleWheel = (e) => {
      if (!this.enabled) return;
      this.wheel += Math.sign(e.deltaY);
    };
    this.handleBlur = () => {
      this.keys.clear();
      this.fireHeld = false;
    };
    this.handlePointerLock = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.fireHeld = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    };
    this.handleContextMenu = (e) => e.preventDefault();
  }

  attach() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLock);
  }

  detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLock);
  }

  lock() {
    if (document.pointerLockElement !== this.canvas) {
      try {
        const request = this.canvas.requestPointerLock?.({ unadjustedMovement: false });
        if (request && request.catch) request.catch(() => {});
      } catch {
        try {
          this.canvas.requestPointerLock?.();
        } catch {
          /* pointer lock unsupported */
        }
      }
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  endFrame() {
    this.pressed.clear();
    this.firePressed = false;
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.fireHeld = false;
    this.firePressed = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}

export class LocalPlayer {
  constructor(camera, callbacks = {}) {
    this.camera = camera;
    this.callbacks = callbacks;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.grounded = true;
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 1;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.shake = 0;
    this.fovKick = 0;
    this.bobPhase = 0;
    this.landDip = 0;
    this.stepTimer = 0;
    this.speed = 0;
    this.moving = false;
    this.sprinting = false;
    this.baseFov = 76;
    this.camera.rotation.order = 'YXZ';
    this.alive = true;
    this.canMove = true;
    this.dodgeT = 0;
    this.dodgeCooldownUntil = 0;
    this.dodgeRoll = 0;
    this.lastWishX = 0;
    this.lastWishZ = -1;
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y ?? 0;
    this.z = spawn.z;
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.grounded = true;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.shake = 0;
    this.fovKick = 0;
    this.landDip = 0;
    this.dodgeT = 0;
    this.dodgeRoll = 0;
    this.alive = true;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.applyCamera(0, 0);
  }

  addRecoil(pitch, yaw) {
    this.recoilPitch = Math.min(0.35, this.recoilPitch + pitch);
    this.recoilYaw += yaw;
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  addFovKick(amount) {
    this.fovKick = Math.min(8, this.fovKick + amount);
  }

  getForward(target = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    target.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    return target.normalize();
  }

  getMuzzleWorld(target = new THREE.Vector3()) {
    this.getForward(this._dir);
    this._right.crossVectors(this._dir, this._up).normalize();
    target.copy(this.camera.position);
    target.addScaledVector(this._dir, 0.55);
    target.addScaledVector(this._right, 0.19);
    target.y -= 0.12;
    return target;
  }

  forwardFlat() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  /** Combat roll: short burst with server-validated i-frames. */
  startDodge(dirX, dirZ, now = performance.now()) {
    if (now < this.dodgeCooldownUntil || this.dodgeT > 0 || !this.grounded) return false;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.vx = (dirX / len) * 23;
    this.vz = (dirZ / len) * 23;
    this.dodgeT = 0.34;
    this.dodgeCooldownUntil = now + 2600;
    this.dodgeRoll = (Math.random() > 0.5 ? 1 : -1) * 0.13;
    this.addFovKick(2.4);
    this.callbacks.onDodge?.();
    return true;
  }

  dodgeReadyIn(now = performance.now()) {
    return Math.max(0, this.dodgeCooldownUntil - now);
  }

  update(dt, input, canMove) {
    const mouse = input.consumeMouse();
    const sens = 0.0023 * this.sensitivity;
    if (this.alive) {
      this.yaw -= mouse.dx * sens;
      this.pitch -= mouse.dy * sens;
      this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));
      this.yaw = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    }

    this.recoilPitch *= Math.exp(-dt * 9);
    this.recoilYaw *= Math.exp(-dt * 9);
    this.shake *= Math.exp(-dt * 7);
    this.fovKick *= Math.exp(-dt * 8);
    this.landDip *= Math.exp(-dt * 10);
    this.dodgeRoll *= Math.exp(-dt * 5.5);

    const allow = canMove && this.alive && this.controlsEnabled !== false;
    let ax = 0;
    let az = 0;
    if (allow) {
      if (input.isDown('KeyW')) az += 1;
      if (input.isDown('KeyS')) az -= 1;
      if (input.isDown('KeyD')) ax += 1;
      if (input.isDown('KeyA')) ax -= 1;
    }

    const len = Math.hypot(ax, az);
    if (len > 1) {
      ax /= len;
      az /= len;
    }
    this.moving = len > 0.01;
    this.sprinting = this.moving && (input.isDown('ShiftLeft') || input.isDown('ShiftRight'));

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    if (this.moving) {
      this.lastWishX = -sin * az + cos * ax;
      this.lastWishZ = -cos * az - sin * ax;
    }

    const dodging = this.dodgeT > 0;
    if (dodging) {
      this.dodgeT = Math.max(0, this.dodgeT - dt);
      const drag = Math.exp(-5.5 * dt);
      this.vx *= drag;
      this.vz *= drag;
    } else {
      const targetSpeed = this.sprinting ? 11.6 : 8.2;
      const wishX = (-sin * az + cos * ax) * targetSpeed;
      const wishZ = (-cos * az - sin * ax) * targetSpeed;
      const accel = this.grounded ? 14 : 4.5;
      const k = 1 - Math.exp(-accel * dt);
      this.vx += (wishX - this.vx) * k;
      this.vz += (wishZ - this.vz) * k;
      if (!this.moving && this.grounded) {
        const friction = 1 - Math.exp(-12 * dt);
        this.vx -= this.vx * friction;
        this.vz -= this.vz * friction;
      }
    }

    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    const safe = resolveCollision(nx, nz, PLAYER_RADIUS);
    if (Math.abs(safe.x - nx) > 1e-4) this.vx *= 0.2;
    if (Math.abs(safe.z - nz) > 1e-4) this.vz *= 0.2;
    this.x = safe.x;
    this.z = safe.z;

    if (allow && !dodging && this.grounded && input.wasPressed('Space')) {
      this.vy = 7.2;
      this.grounded = false;
      this.callbacks.onJump?.();
    }

    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.landDip = 0.12;
        this.callbacks.onLand?.();
      }
    } else {
      this.y = 0;
    }

    const hSpeed = Math.hypot(this.vx, this.vz);
    this.speed = hSpeed;
    if (this.grounded && hSpeed > 0.8) {
      this.stepTimer -= dt * (this.sprinting ? 1.35 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.38;
        this.callbacks.onFootstep?.(this.sprinting);
      }
      this.bobPhase += dt * (6.5 + hSpeed * 0.45);
    } else {
      this.bobPhase += dt * 1.2;
    }

    this.applyCamera(dt, hSpeed);
  }

  applyCamera(dt, hSpeed) {
    const bobAmount = this.grounded ? Math.min(1, hSpeed / 8) : 0;
    const bobY = Math.sin(this.bobPhase * 2) * 0.05 * bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.035 * bobAmount;
    const strafeLean = (this.vx * Math.cos(this.yaw) - this.vz * Math.sin(this.yaw)) * 0.0022;
    const shakeX = (Math.random() - 0.5) * this.shake * 0.05;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.05;

    this.camera.position.set(
      this.x + Math.cos(this.yaw) * bobX,
      this.y + EYE_HEIGHT + bobY - this.landDip,
      this.z - Math.sin(this.yaw) * bobX,
    );
    this.camera.rotation.y = this.yaw + this.recoilYaw + shakeX;
    this.camera.rotation.x = this.pitch + this.recoilPitch + shakeY;
    this.camera.rotation.z = -strafeLean * 0.35 + this.dodgeRoll;

    const targetFov = this.baseFov + (this.sprinting && this.moving ? 4 : 0) + this.fovKick;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, (dt || 0.016) * 12);
      this.camera.updateProjectionMatrix();
    }
  }

  syncToServer(x, y, z) {
    const d = Math.hypot(this.x - x, this.z - z);
    if (d > 3.2) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.vx = 0;
      this.vz = 0;
      return true;
    }
    if (d > 1.1) {
      const k = Math.min(0.35, d * 0.08);
      this.x += (x - this.x) * k;
      this.z += (z - this.z) * k;
    }
    return false;
  }
}

const AVATAR_COLORS = [0x00e5ff, 0xff7a3d, 0x8dff6b, 0xffd24a, 0xff5c7a, 0x7df3ff, 0xc46bff, 0xffa8c8];

function colorForName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function angleTo(current, target, k) {
  let d = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * k;
}

function makeTagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { canvas, ctx, tex };
}

/**
 * A humanoid combat robot. When killed it topples over and stays on the field
 * as a wreck until it is rebuilt at a spawn point.
 */
export class RemoteAvatar {
  constructor(scene, data) {
    this.id = data.id;
    this.name = data.name || 'ROBOT';
    this.bot = !!data.bot;
    this.scene = scene;
    this.color = colorForName(this.name);
    this.colorHex = `#${this.color.toString(16).padStart(6, '0')}`;
    this.target = { x: 0, y: 0, z: 0, yaw: 0, health: 100, alive: true, weapon: 'rifle' };
    this.initialized = false;
    this.wasAlive = true;
    this.flashT = 0;
    this.legPhase = Math.random() * 6;
    this.ringPhase = Math.random() * 6;
    this.lastHealth = -1;
    this.tagTimer = 0;
    this.disposed = false;
    this.fallT = 0;
    this.fallDir = 1;
    this.bodyYaw = 0;
    this.lastMoved = 0;

    this.root = new THREE.Group();
    this.root.name = `robot_${this.id}`;
    scene.add(this.root);

    this.body = new THREE.Group();
    this.root.add(this.body);

    const accent = new THREE.Color(this.color);
    this.chassisMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3aa,
      metalness: 0.62,
      roughness: 0.46,
      emissive: new THREE.Color(0x000000),
    });
    this.plateMat = new THREE.MeshStandardMaterial({
      color: 0x6c757d,
      metalness: 0.55,
      roughness: 0.5,
    });
    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x262c32, metalness: 0.7, roughness: 0.4 });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.7,
      metalness: 0.3,
      roughness: 0.35,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0xffb27a,
      emissive: new THREE.Color(0xff5a1f),
      emissiveIntensity: 2.6,
      metalness: 0.3,
      roughness: 0.25,
    });

    const box = (w, h, d, x, y, z, mat, parent = this.body) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const ball = (r, x, y, z, mat, parent = this.body) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Pelvis + torso.
    box(0.44, 0.24, 0.3, 0, 1.02, 0, this.darkMat);
    box(0.56, 0.56, 0.34, 0, 1.42, 0, this.chassisMat);
    box(0.44, 0.34, 0.07, 0, 1.45, -0.2, this.plateMat);
    box(0.16, 0.1, 0.05, 0, 1.5, -0.245, this.accentMat);
    box(0.5, 0.14, 0.36, 0, 1.12, 0, this.darkMat);
    box(0.34, 0.36, 0.16, 0, 1.42, 0.24, this.plateMat);
    box(0.08, 0.3, 0.08, 0.18, 1.62, 0.22, this.darkMat);

    // Neck + head.
    box(0.14, 0.12, 0.14, 0, 1.75, 0, this.darkMat);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.91, 0);
    this.body.add(this.head);
    box(0.3, 0.28, 0.3, 0, 0, 0, this.chassisMat, this.head);
    box(0.24, 0.075, 0.03, 0, 0.03, -0.155, this.visorMat, this.head);
    box(0.2, 0.05, 0.03, 0, -0.075, -0.152, this.darkMat, this.head);
    box(0.05, 0.06, 0.05, -0.16, 0.02, 0, this.accentMat, this.head);
    box(0.05, 0.06, 0.05, 0.16, 0.02, 0, this.accentMat, this.head);
    // Antenna.
    box(0.03, 0.2, 0.03, 0.1, 0.24, 0.06, this.darkMat, this.head);
    ball(0.035, 0.1, 0.35, 0.06, this.accentMat, this.head);

    // Shoulders + arms.
    ball(0.14, -0.34, 1.66, 0, this.accentMat);
    ball(0.14, 0.34, 1.66, 0, this.accentMat);

    const arm = (side) => {
      const group = new THREE.Group();
      group.position.set(side * 0.36, 1.64, 0);
      this.body.add(group);
      box(0.12, 0.34, 0.14, 0, -0.18, 0, this.chassisMat, group);
      ball(0.075, 0, -0.37, 0, this.darkMat, group);
      box(0.1, 0.32, 0.12, 0, -0.54, 0, this.plateMat, group);
      box(0.12, 0.12, 0.14, 0, -0.72, -0.02, this.darkMat, group);
      return group;
    };
    this.armR = arm(1);
    this.armL = arm(-1);

    // Rifle in the right hand.
    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0.03, -0.72, -0.12);
    this.armR.add(this.gunGroup);
    box(0.1, 0.12, 0.52, 0, 0, -0.24, this.darkMat, this.gunGroup);
    box(0.06, 0.05, 0.34, 0, 0.02, -0.4, this.accentMat, this.gunGroup);
    box(0.07, 0.14, 0.1, 0, -0.12, -0.16, this.darkMat, this.gunGroup);
    this.gunTip = new THREE.Object3D();
    this.gunTip.position.set(0, 0.01, -0.55);
    this.gunGroup.add(this.gunTip);

    // Legs.
    const leg = (side) => {
      const group = new THREE.Group();
      group.position.set(side * 0.16, 1.0, 0);
      this.body.add(group);
      box(0.17, 0.42, 0.2, 0, -0.22, 0, this.chassisMat, group);
      ball(0.08, 0, -0.45, 0, this.darkMat, group);
      box(0.15, 0.4, 0.18, 0, -0.65, 0, this.plateMat, group);
      box(0.19, 0.1, 0.3, 0, -0.88, -0.05, this.darkMat, group);
      return group;
    };
    this.legL = leg(-1);
    this.legR = leg(1);

    // Ground marker.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.54, 28),
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.root.add(this.ring);

    // Name + health tag.
    const { canvas, ctx, tex } = makeTagTexture();
    this.tag = { canvas, ctx, tex };
    this.tagSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false }),
    );
    this.tagSprite.scale.set(2.1, 0.79, 1);
    this.tagSprite.position.y = 2.45;
    this.root.add(this.tagSprite);
    this.refreshTag();

    this.root.visible = false;
  }

  refreshTag() {
    const { ctx, canvas, tex } = this.tag;
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 30px "Segoe UI", Arial, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.name.toUpperCase(), w / 2, 30);
    if (this.bot) {
      ctx.shadowBlur = 0;
      ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = this.colorHex;
      ctx.fillText('ROBOT', w / 2, 56);
    }
    const health = Math.max(0, Math.min(100, this.target.health ?? 100));
    const barW = 190;
    const barX = (w - barW) / 2;
    const barY = 84;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8, 12, 10, 0.82)';
    ctx.fillRect(barX - 3, barY - 3, barW + 6, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 3, barY - 3, barW + 6, 18);
    const hue = health > 55 ? 130 : health > 28 ? 42 : 2;
    ctx.fillStyle = `hsl(${hue} 90% 56%)`;
    ctx.fillRect(barX, barY, (barW * health) / 100, 12);
    tex.needsUpdate = true;
    void h;
  }

  setTarget(p) {
    if (!p) return;
    const wasAlive = this.target.alive;
    this.target = {
      x: p.x,
      y: p.y ?? 0,
      z: p.z,
      yaw: p.yaw ?? 0,
      health: p.health ?? 100,
      alive: p.alive !== false,
      weapon: p.weapon || 'rifle',
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
      // Rebuilt: stand back up at the new spawn.
      this.root.position.set(p.x, p.y ?? 0, p.z);
      this.body.rotation.set(0, 0, 0);
      this.body.position.y = 0;
      this.fallT = 0;
      this.tagSprite.visible = true;
      this.ring.visible = true;
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
    }
    if (!this.target.alive && wasAlive) {
      this.fallT = 0.0001;
      this.fallDir = Math.random() > 0.5 ? 1 : -1;
    }
    this.wasAlive = this.target.alive;
  }

  flash() {
    this.flashT = 0.16;
  }

  getMuzzleWorld(target = new THREE.Vector3()) {
    this.gunTip.getWorldPosition(target);
    return target;
  }

  update(dt, camera, time) {
    if (this.disposed) return;
    const t = this.target;
    void camera;

    if (t.alive) {
      this.root.visible = true;
      this.tagSprite.visible = true;
      this.ring.visible = true;
    } else {
      // Fall over, then remain as a wreck.
      this.root.visible = true;
      this.tagSprite.visible = false;
      this.ring.visible = false;
      if (this.fallT === 0) this.fallT = 0.0001;
    }

    if (!t.alive) {
      this.fallT = Math.min(2.4, this.fallT + dt);
      const k = Math.min(1, this.fallT / 0.72);
      const eased = 1 - Math.pow(1 - k, 3);
      // Slight bounce when the chassis hits the dirt.
      const bounce = k >= 1 ? Math.sin(Math.min(1, (this.fallT - 0.72) / 0.5) * Math.PI) * 0.035 : 0;
      this.body.rotation.x = -eased * (Math.PI / 2 - 0.04) * this.fallDir;
      this.body.rotation.z = eased * 0.09 * this.fallDir;
      this.body.position.y = bounce;
      this.armR.rotation.x = -1.2 + eased * 1.7;
      this.armL.rotation.x = -0.3 - eased * 1.5;
      this.legL.rotation.x = -0.15 - eased * 0.25;
      this.legR.rotation.x = 0.1 + eased * 0.2;
      if (this.flashT > 0) {
        this.flashT = Math.max(0, this.flashT - dt);
        this.chassisMat.emissive.setRGB(this.flashT * 4, this.flashT * 2.4, this.flashT * 1.4);
      } else {
        this.chassisMat.emissive.setRGB(0, 0, 0);
      }
      return;
    }

    const prevX = this.root.position.x;
    const prevZ = this.root.position.z;
    const k = 1 - Math.exp(-dt * 17);
    this.root.position.x += (t.x - this.root.position.x) * k;
    this.root.position.y += (t.y - this.root.position.y) * k;
    this.root.position.z += (t.z - this.root.position.z) * k;
    this.root.rotation.y = angleTo(this.root.rotation.y, t.yaw, 1 - Math.exp(-dt * 20));

    const moved = dt > 0 ? Math.hypot(this.root.position.x - prevX, this.root.position.z - prevZ) / dt : 0;
    this.lastMoved = moved;
    const moving = moved > 0.35;
    this.legPhase += dt * (moving ? 9 : 2.2);
    const swing = moving ? Math.sin(this.legPhase) * 0.6 : Math.sin(this.legPhase) * 0.04;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.55;
    this.armR.rotation.x = -1.15 + swing * 0.12;
    this.body.position.y = Math.abs(Math.sin(this.legPhase)) * (moving ? 0.03 : 0.01);
    this.body.rotation.z = Math.sin(this.legPhase) * (moving ? 0.022 : 0.005);
    this.body.rotation.x = 0;
    this.head.rotation.y = Math.sin(time * 0.7 + this.legPhase * 0.4) * 0.12;

    this.ringPhase += dt * 2;
    this.ring.material.opacity = 0.28 + Math.sin(this.ringPhase) * 0.12;
    this.ring.rotation.z += dt * 0.6;

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      const f = this.flashT / 0.16;
      this.chassisMat.emissive.setRGB(f * 1.4, f * 0.9, f * 0.6);
    } else {
      this.chassisMat.emissive.setRGB(0, 0, 0);
    }

    this.tagSprite.position.y = 2.45 + Math.sin(time * 2 + this.ringPhase) * 0.03;
    this.tagTimer -= dt;
    if (this.tagTimer <= 0) {
      this.tagTimer = 0.25;
      this.refreshTag();
    }
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
