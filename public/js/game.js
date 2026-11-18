import * as THREE from 'three';
import { rayHitsAnimal, rayHitsArena, rayHitsPlayer } from './arena.js';
import { Effects } from './effects.js';
import { Input, LocalPlayer, RemoteAvatar } from './player.js';
import { WEAPONS, WEAPON_ORDER, createViewmodel } from './weapons.js';
import { buildWorld } from './world.js';
import { AnimalField } from './animals.js';

const MAX_LIVES = 5;

const TMP_DIR = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_UP = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function freshMags() {
  const mags = {};
  for (const id of WEAPON_ORDER) mags[id] = WEAPONS[id].mag;
  return mags;
}

export class Game {
  constructor(canvas, ui, audio) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;
    this.mode = 'menu';
    this.paused = false;
    this.selfId = null;
    this.selfName = null;
    this.roomCode = '';
    this.latestPlayers = [];
    this.roomState = 'playing';
    this.deathTilt = 0;
    this.previewAngle = 0.7;
    this.quality = 'high';
    this.moveAccumulator = 0;
    this.clock = 0;
    this.lives = MAX_LIVES;
    this.hunts = 0;
    this.loadout = 'rifle';

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.08, 420);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.world = buildWorld(this.scene);
    this.effects = new Effects(this.scene);
    this.animalField = new AnimalField(this.scene);

    // Separate scene so the weapon never clips through walls.
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 6);
    this.viewScene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const viewKey = new THREE.DirectionalLight(0xd9ecff, 1.5);
    viewKey.position.set(0.6, 1.2, 0.8);
    this.viewScene.add(viewKey);
    const viewRim = new THREE.PointLight(0x43e8ff, 3.2, 4, 2);
    viewRim.position.set(-0.8, 0.2, 0.6);
    this.viewScene.add(viewRim);
    const viewRim2 = new THREE.PointLight(0xff3ddc, 2.6, 4, 2);
    viewRim2.position.set(0.9, -0.4, 0.4);
    this.viewScene.add(viewRim2);

    this.avatars = new Map();
    this.input = new Input(canvas);
    this.input.attach();
    this.local = new LocalPlayer(this.camera, {
      onJump: () => this.audio.playJump(),
      onLand: () => this.audio.playLand(),
      onFootstep: () => this.audio.playFootstep(),
      onDodge: () => this.audio.playDodge?.(),
    });

    this.weaponId = 'rifle';
    this.mags = freshMags();
    this.magSize = WEAPONS.rifle.mag;
    this.reloading = false;
    this.reloadStart = 0;
    this.reloadEnd = 0;
    this.lastFire = 0;
    this.gunKick = 0;
    this.gunRoot = null;
    this.gunMuzzle = null;
    this.viewFlash = null;
    this.viewFlashTimer = 0;
    this.deathCameraPos = null;
    this.deathCameraRot = null;

    this.onMove = null;
    this.onShoot = null;
    this.onWeaponChange = null;
    this.onDodge = null;
    this.onLockChange = null;

    this.input.onLockChange = (locked) => {
      this.ui.setLockHint(this.mode === 'playing' && !locked && !this.paused);
      if (this.onLockChange) this.onLockChange(locked);
    };

    this.setupViewmodelFlash();
    this.handleResize = () => this.resize();
    window.addEventListener('resize', this.handleResize);

    // Start on the attract / menu orbit camera.
    this.setMenuCamera();
    this.lastFrame = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  setupViewmodelFlash() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.flashTexture = tex;
    this.viewFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        color: 0xbfe9ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.viewFlash.scale.setScalar(0.35);
    this.viewFlash.visible = false;
    this.viewFlash.renderOrder = 20;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
  }

  setQuality(quality) {
    this.quality = quality;
    const high = quality === 'high';
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 1.75) : Math.min(window.devicePixelRatio || 1, 1));
    this.renderer.shadowMap.enabled = high;
    this.world.lights.key.castShadow = high;
    this.scene.traverse((o) => {
      if (o.isMesh && o.material) o.material.needsUpdate = true;
    });
    this.ui.setQuality(quality);
  }

  setMenuCamera() {
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(42, 26, 42);
    this.camera.lookAt(0, 4, 0);
  }

  getWeapon() {
    return WEAPONS[this.weaponId] || WEAPONS.rifle;
  }

  // ------------------------------------------------------------------
  // Session lifecycle
  // ------------------------------------------------------------------
  startSession(joined) {
    this.selfId = joined.selfId;
    this.selfName = joined.name;
    this.roomCode = joined.room?.code || '----';
    this.roomState = joined.room?.state || 'playing';
    this.ui.setSelf(this.selfId, this.selfName);
    this.ui.setRoom(this.roomCode);
    this.ui.showHud();
    this.ui.setMenuError('');
    this.ui.setMenuBusy(false);
    this.ui.showResults(null);
    this.ui.signalLost(false);
    this.ui.showPause(false);
    this.ui.hideEliminated();
    this.ui.clearFeed();
    this.ui.setStreak(0);
    this.ui.setHealth(100);
    this.ui.setScores(0, 0);

    for (const av of this.avatars.values()) av.dispose();
    this.avatars.clear();
    this.animalField.applySnapshot([]);

    for (const p of joined.players || []) {
      if (p.id !== this.selfId) this.getOrCreateAvatar(p);
    }
    this.latestPlayers = joined.players || [];
    this.ui.updateScoreboard(this.latestPlayers, this.selfId);

    const self = (joined.players || []).find((p) => p.id === this.selfId);
    const spawn = self
      ? { x: self.x, y: self.y, z: self.z, yaw: self.yaw }
      : { x: 0, y: 0, z: 24, yaw: 0 };
    this.local.reset(spawn);
    this.local.alive = self ? self.alive : true;
    this.local.controlsEnabled = true;
    this.local.dodgeCooldownUntil = 0;
    this.deathTilt = 0;

    this.lives = self?.lives ?? MAX_LIVES;
    this.hunts = self?.hunts ?? 0;
    this.ui.setLives(this.lives, MAX_LIVES);
    this.ui.setHunts(this.hunts);
    this.ui.setDodge(0);

    this.mags = freshMags();
    this.reloading = false;
    this.ui.setReload(null);
    const startWeapon = self && WEAPONS[self.weapon] ? self.weapon : this.loadout;
    this.weaponId = null;
    this.equipWeapon(startWeapon, true);
    this.ui.setHealth(self?.health ?? 100);
    this.ui.setShield(false);
    this.ui.setScores(self?.kills ?? 0, self?.deaths ?? 0);
    this.ui.setTimer(joined.room?.timeLeft ?? 300);
    this.ui.setRespawnHint(false);
    this.ui.hideDeath();
    this.ui.setCrosshairVisible(true);
    this.ui.setStreak(0);

    this.mode = this.local.alive ? 'playing' : 'dead';
    this.paused = false;
    this.gunRoot.visible = this.mode === 'playing';
    this.ui.setLockHint(this.mode === 'playing' && !this.input.locked);
    this.sendMove(true);
    this.ui.notice(`Connected to room ${this.roomCode}`, 'streak');
  }

  resetToMenu() {
    this.mode = 'menu';
    this.paused = false;
    this.selfId = null;
    this.roomCode = '';
    this.deathTilt = 0;
    this.reloading = false;
    this.ui.setReload(null);
    this.gunRoot && (this.gunRoot.visible = false);
    this.ui.setCrosshairVisible(true);
    this.ui.showMenu();
    this.ui.signalLost(false);
    this.ui.setMenuBusy(false);
    for (const av of this.avatars.values()) av.dispose();
    this.avatars.clear();
    this.animalField.applySnapshot([]);
    this.setMenuCamera();
  }

  setPaused(paused) {
    this.paused = paused;
    this.ui.setLockHint(false);
    if (paused) {
      this.input.fireHeld = false;
      this.ui.showScoreboard(false);
    }
  }

  setDisconnected(disconnected) {
    if (disconnected) {
      this.paused = true;
      this.input.fireHeld = false;
      this.ui.signalLost(true);
    } else {
      this.paused = false;
      this.ui.signalLost(false);
    }
  }

  // ------------------------------------------------------------------
  // Network events
  // ------------------------------------------------------------------
  getOrCreateAvatar(p) {
    let av = this.avatars.get(p.id);
    if (!av) {
      av = new RemoteAvatar(this.scene, p);
      this.avatars.set(p.id, av);
    }
    av.setTarget(p);
    return av;
  }

  applySnapshot(snap) {
    if (this.mode === 'menu') return;
    this.latestPlayers = snap.players || [];
    const now = Date.now();
    let self = null;
    const seen = new Set();

    for (const p of snap.players || []) {
      seen.add(p.id);
      if (p.id === this.selfId) {
        self = p;
        continue;
      }
      this.getOrCreateAvatar(p);
    }
    for (const [id, av] of this.avatars) {
      if (!seen.has(id)) {
        av.dispose();
        this.avatars.delete(id);
      }
    }

    if (Array.isArray(snap.animals)) this.animalField.applySnapshot(snap.animals);

    if (self) {
      this.ui.setHealth(self.health);
      this.ui.setShield(!!self.shield);
      this.ui.setScores(self.kills, self.deaths);
      this.ui.setStreak(self.streak || 0);
      this.lives = self.lives ?? this.lives;
      this.hunts = self.hunts ?? this.hunts;
      this.ui.setLives(this.lives, MAX_LIVES);
      this.ui.setHunts(this.hunts);
      if (typeof self.dodgeIn === 'number' && self.dodgeIn > 0) {
        this.local.dodgeCooldownUntil = Math.max(
          this.local.dodgeCooldownUntil,
          performance.now() + self.dodgeIn,
        );
      }
      if (self.alive) {
        if (this.mode === 'dead') this.handleSelfRespawn();
        this.local.syncToServer(self.x, self.y, self.z);
      } else if (this.mode === 'playing') {
        this.mode = 'dead';
        this.local.alive = false;
        this.gunRoot.visible = false;
      }
      if (self.eliminated && this.mode !== 'eliminated' && this.mode !== 'ended') {
        this.enterEliminated('THE FIELD', self.weapon);
      }
    }
    this.ui.setTimer(snap.timeLeft);
    if (!this.ui.scoreboardEl.classList.contains('hidden')) {
      this.ui.updateScoreboard(this.latestPlayers, this.selfId);
    }
    this.roomState = snap.state;
    this.serverNow = now;
  }

  onRemoteShot(data) {
    if (this.mode === 'menu') return;
    if (data.shooterId === this.selfId) return;
    const def = WEAPONS[data.weapon] || WEAPONS.rifle;
    const av = this.avatars.get(data.shooterId);
    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z);
    let start = origin.clone().addScaledVector(dir, 0.45);
    if (av && av.target.alive) {
      start = av.getMuzzleWorld(new THREE.Vector3());
    }
    this.effects.spawnMuzzleFlash(start, def.color, 0.55);
    for (const e of data.ends || []) {
      const end = new THREE.Vector3(e.x, e.y, e.z);
      this.effects.spawnTracer(start, end, def.color, 0.04, 0.11);
    }
    const dist = this.camera.position.distanceTo(origin);
    this.audio.playRemoteShoot(data.weapon, dist);
  }

  onRemoteDodge(data) {
    if (this.mode === 'menu') return;
    if (data.id === this.selfId) return;
    const av = this.avatars.get(data.id);
    const x = Number.isFinite(data.x) ? data.x : av?.root.position.x ?? 0;
    const z = Number.isFinite(data.z) ? data.z : av?.root.position.z ?? 0;
    const pos = new THREE.Vector3(x, 0.15, z);
    this.effects.spawnRing(pos, '#d8c3a0', 1.7, 0.5);
    this.effects.spawnImpact(pos, '#cbb08a', 7);
    const dist = this.camera.position.distanceTo(pos);
    this.audio.playDodgeRemote?.(dist);
  }

  onHit(data) {
    if (this.mode === 'menu') return;
    const isAttacker = data.attackerId === this.selfId;
    const isVictim = data.targetId === this.selfId;
    if (isAttacker) {
      this.ui.hitmarker(data.headshot, data.killed);
      this.ui.damageNumber(data.damage, data.headshot);
      this.audio.playHitmarker(data.headshot, data.killed);
    }
    if (isVictim) {
      this.ui.setHealth(data.health);
      this.ui.flashDamage();
      this.audio.playDamage(data.damage);
      this.local.addShake(0.28 + Math.min(0.5, data.damage * 0.007));
      // Point at whoever is shooting at us.
      const attackerAv = data.attackerId ? this.avatars.get(data.attackerId) : null;
      if (attackerAv) {
        const dx = attackerAv.root.position.x - this.local.x;
        const dz = attackerAv.root.position.z - this.local.z;
        if (Math.hypot(dx, dz) > 0.05) {
          const sourceYaw = Math.atan2(-dx, -dz);
          const rel = Math.atan2(Math.sin(sourceYaw - this.local.yaw), Math.cos(sourceYaw - this.local.yaw));
          this.ui.showHitDirection(-rel);
        }
      }
    }
    const av = this.avatars.get(data.targetId);
    if (av) av.flash();
    if (data.point) {
      this.effects.spawnImpact(
        new THREE.Vector3(data.point.x, data.point.y, data.point.z),
        isAttacker ? '#bffcff' : '#ffb03d',
        isAttacker ? 10 : 6,
      );
    }
  }

  onAnimalHit(data) {
    if (this.mode === 'menu') return;
    const isAttacker = data.attackerId === this.selfId;
    this.animalField.flash(data.animalId);
    if (data.point) {
      this.effects.spawnImpact(
        new THREE.Vector3(data.point.x, data.point.y, data.point.z),
        isAttacker ? '#ffd9a0' : '#c98b5e',
        isAttacker ? 8 : 5,
      );
    }
    if (isAttacker) {
      this.ui.hitmarker(false, data.killed);
      if (!data.killed) this.ui.damageNumber(data.damage);
      this.audio.playHitmarker(false, data.killed);
    }
  }

  onAnimalKilled(data) {
    if (this.mode === 'menu') return;
    this.animalField.kill(data.animalId);
    if (data.point) {
      this.effects.spawnKillBurst(new THREE.Vector3(data.point.x, data.point.y, data.point.z), '#ffcf87');
    } else {
      const animal = this.animalField.get(data.animalId);
      if (animal) {
        this.effects.spawnKillBurst(
          new THREE.Vector3(animal.root.position.x, 0.8, animal.root.position.z),
          '#ffcf87',
        );
      }
    }
    if (data.attackerId === this.selfId) {
      this.hunts = data.hunts || this.hunts + 1;
      this.ui.setHunts(this.hunts);
      this.ui.killBanner(`HUNTED ${data.label} · +${data.heal} HULL`);
      this.ui.notice(`+${data.heal} hull · ${data.hunts} hunt${data.hunts === 1 ? '' : 's'}`, 'heal');
      this.audio.playKill();
      this.audio.playHeal?.();
    }
    this.ui.killFeed({
      killerName: data.attackerName || 'A HUNTER',
      victimName: data.label,
      weapon: data.weapon,
      headshot: false,
      selfKill: data.attackerId === this.selfId,
      animal: true,
    });
  }

  onKill(data) {
    if (this.mode === 'menu') return;
    const av = this.avatars.get(data.victimId);
    const color = av ? av.colorHex : '#ff3ddc';
    if (data.point) {
      this.effects.spawnKillBurst(new THREE.Vector3(data.point.x, data.point.y, data.point.z), color);
    }
    const isSelfKill = data.killerId === this.selfId;
    if (isSelfKill) {
      this.ui.killBanner(`ELIMINATED ${data.victimName.toUpperCase()}${data.headshot ? ' · HEADSHOT' : ''}`);
      this.audio.playKill();
    }
    this.ui.killFeed({
      killerName: data.killerName,
      victimName: `${data.victimName}${data.eliminated ? ' (OUT)' : ''}`,
      weapon: data.weapon,
      headshot: data.headshot,
      selfKill: isSelfKill,
      selfDeath: data.victimId === this.selfId,
    });
    if (av) {
      // Let the robot topple over instead of vanishing.
      av.target.alive = false;
    }
  }

  onSelfDeath(data) {
    this.lives = Math.max(0, data.lives ?? this.lives);
    this.ui.setLives(this.lives, MAX_LIVES);
    this.local.alive = false;
    this.reloading = false;
    this.ui.setReload(null);
    this.ui.setHealth(0);
    this.ui.setShield(false);
    this.ui.setLockHint(false);
    this.input.fireHeld = false;
    if (this.gunRoot) this.gunRoot.visible = false;
    this.deathTilt = 0;
    this.deathCameraPos = this.camera.position.clone();
    this.deathCameraRot = this.camera.rotation.clone();
    this.audio.playDeath();

    if (data.eliminated) {
      this.enterEliminated(data.killerName, data.weapon);
      return;
    }

    this.mode = 'dead';
    this.ui.showDeath(data.killerName, data.weapon, data.respawnIn, this.lives, MAX_LIVES);
  }

  enterEliminated(killerName, weapon) {
    this.mode = 'eliminated';
    this.local.alive = false;
    this.local.controlsEnabled = false;
    this.reloading = false;
    this.ui.setReload(null);
    this.ui.setHealth(0);
    this.ui.setShield(false);
    this.ui.setLockHint(false);
    this.input.fireHeld = false;
    this.input.unlock();
    if (this.gunRoot) this.gunRoot.visible = false;
    this.deathTilt = 0;
    this.ui.setLives(0, MAX_LIVES);
    this.ui.showEliminated(killerName, weapon, this.hunts);
    this.ui.setCrosshairVisible(false);
  }

  handleSelfRespawn() {
    if (this.mode !== 'dead') {
      if (this.gunRoot) this.gunRoot.visible = this.mode === 'playing';
      return;
    }
    this.mode = 'playing';
    this.local.alive = true;
    this.local.controlsEnabled = true;
    this.deathTilt = 0;
    this.ui.hideDeath();
    this.ui.hideEliminated();
    this.ui.setHealth(100);
    this.ui.setShield(true);
    this.ui.setRespawnHint(false);
    this.ui.setCrosshairVisible(true);
    this.ui.setLockHint(!this.input.locked);
    if (this.gunRoot) this.gunRoot.visible = true;
    this.audio.playRespawn();
    this.local.dodgeCooldownUntil = 0;
    this.mags = freshMags();
    this.ui.setAmmo(this.mags[this.weaponId]);
  }

  onRespawn(data) {
    if (data.id === this.selfId) {
      this.local.reset({ x: data.x, y: data.y, z: data.z, yaw: data.yaw });
      this.handleSelfRespawn();
      this.sendMove(true);
    } else {
      const av = this.avatars.get(data.id);
      if (av) {
        av.root.position.set(data.x, data.y, data.z);
        av.root.rotation.y = data.yaw;
      }
    }
  }

  onMatchEnd(data) {
    this.mode = 'ended';
    this.local.controlsEnabled = false;
    this.ui.showResults(data, this.selfId, (data.restartIn || 14000) / 1000);
    this.ui.setLockHint(false);
    this.input.fireHeld = false;
    this.input.unlock();
    this.ui.setRespawnHint(false);
    this.reloading = false;
    this.ui.setReload(null);
    if (this.gunRoot) this.gunRoot.visible = false;
    this.audio.playKill();
  }

  onMatchStart() {
    this.mode = 'playing';
    this.deathTilt = 0;
    this.paused = false;
    this.local.alive = true;
    this.local.controlsEnabled = true;
    this.local.dodgeCooldownUntil = 0;
    this.lives = MAX_LIVES;
    this.hunts = 0;
    this.ui.setLives(MAX_LIVES, MAX_LIVES);
    this.ui.setHunts(0);
    this.ui.setDodge(0);
    this.ui.showResults(null);
    this.ui.showPause(false);
    this.ui.hideDeath();
    this.ui.hideEliminated();
    this.ui.setCrosshairVisible(true);
    this.ui.setScores(0, 0);
    this.ui.setStreak(0);
    this.ui.setHealth(100);
    this.mags = freshMags();
    this.ui.setAmmo(this.mags[this.weaponId]);
    this.ui.notice('NEW MATCH — FIGHT!', 'streak');
    this.ui.setLockHint(!this.input.locked);
    if (this.gunRoot) this.gunRoot.visible = true;
  }

  // ------------------------------------------------------------------
  // Weapons
  // ------------------------------------------------------------------
  equipWeapon(id, silent = false) {
    if (!WEAPONS[id]) return;
    if (id === this.weaponId && !silent) return;
    this.weaponId = id;
    const def = this.getWeapon();
    this.reloading = false;
    this.ui.setReload(null);
    this.magSize = def.mag;
    this.ui.setMagSize(def.mag);
    this.ui.setWeapon(def);
    this.ui.setAmmo(this.mags[id] ?? def.mag);
    this.buildViewmodel(id);
    if (!silent) {
      this.audio.playSwitch();
      this.onWeaponChange?.(id);
    }
  }

  buildViewmodel(id) {
    if (this.gunRoot) {
      this.viewScene.remove(this.gunRoot);
      this.gunRoot.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material?.dispose?.();
        }
      });
    }
    const { group, muzzle } = createViewmodel(id);
    group.visible = this.mode === 'playing';
    this.gunRoot = group;
    this.gunMuzzle = muzzle;
    this.viewScene.add(group);
    if (this.viewFlash) {
      this.viewFlash.removeFromParent();
      this.viewFlash.position.set(0, 0, 0);
      this.viewFlash.scale.setScalar(id === 'shotgun' ? 0.5 : 0.32);
      muzzle.add(this.viewFlash);
    }
    const def = this.getWeapon();
    this.ui.setCrosshairGap(this.ui.baseGap);
    this.ui.setCrosshairVisible(this.mode === 'playing');
    if (this.viewFlash) this.viewFlash.material.color.set(def.color);
  }

  switchWeapon(id) {
    if (this.mode !== 'playing' || this.paused) return;
    if (id === this.weaponId) return;
    this.equipWeapon(id, false);
  }

  cycleWeapon(dir) {
    const idx = WEAPON_ORDER.indexOf(this.weaponId);
    const next = (idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length;
    this.switchWeapon(WEAPON_ORDER[next]);
  }

  reload() {
    if (this.mode !== 'playing' || this.paused || this.reloading) return;
    const def = this.getWeapon();
    if (this.mags[this.weaponId] >= def.mag) return;
    this.reloading = true;
    this.reloadStart = performance.now();
    this.reloadEnd = this.reloadStart + def.reloadMs;
    this.ui.setReload(0);
    this.audio.playReload(this.weaponId);
  }

  useDodge() {
    if (this.mode !== 'playing' || this.paused || !this.local.alive) return false;
    const input = this.input;
    const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const yaw = this.local.yaw;
    let dx = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
    let dz = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe;
    if (Math.hypot(dx, dz) < 0.01) {
      // Standing still: roll backwards away from the crosshair.
      dx = Math.sin(yaw);
      dz = Math.cos(yaw);
    }
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    if (!this.local.startDodge(dx, dz)) return false;
    this.onDodge?.({ dir: { x: dx, z: dz } });
    return true;
  }

  tryFire(now) {
    if (this.mode !== 'playing' || this.paused || !this.local.alive) return;
    if (!this.input.locked) return;
    if (this.reloading) return;
    const def = this.getWeapon();
    if (now - this.lastFire < def.fireDelay) return;
    if (this.mags[this.weaponId] <= 0) {
      this.audio.playEmpty();
      this.reload();
      return;
    }
    this.lastFire = now;
    this.mags[this.weaponId] -= 1;
    this.ui.setAmmo(this.mags[this.weaponId]);
    if (this.mags[this.weaponId] <= 0) {
      setTimeout(() => {
        if (this.mode === 'playing' && this.mags[this.weaponId] <= 0) this.reload();
      }, 180);
    }

    this.local.getForward(TMP_DIR);
    const origin = this.camera.position.clone();
    const muzzle = this.local.getMuzzleWorld(new THREE.Vector3());
    const tracers = def.id === 'shotgun' ? 5 : def.id === 'smg' ? 2 : 1;
    let endpoint = null;
    let hitAvatar = null;
    let hitAnimal = null;

    for (let i = 0; i < tracers; i++) {
      TMP_RIGHT.crossVectors(TMP_DIR, WORLD_UP).normalize();
      TMP_UP.crossVectors(TMP_RIGHT, TMP_DIR).normalize();
      const spread = def.spread * (i === 0 ? 0.4 : 1);
      const dir = TMP_DIR.clone()
        .addScaledVector(TMP_RIGHT, (Math.random() * 2 - 1) * spread)
        .addScaledVector(TMP_UP, (Math.random() * 2 - 1) * spread)
        .normalize();
      const trace = this.traceShot(origin, dir, def.range);
      endpoint = trace.point;
      hitAvatar = trace.avatar;
      hitAnimal = trace.animal;
      this.effects.spawnTracer(muzzle, trace.point, def.color, def.id === 'shotgun' ? 0.03 : 0.045, 0.1);
      if (trace.avatar) {
        this.effects.spawnImpact(trace.point, '#bffcff', 5);
      } else if (trace.animal) {
        this.effects.spawnImpact(trace.point, '#ffd9a0', 6);
      } else {
        this.effects.spawnImpact(trace.point, def.color, def.id === 'shotgun' ? 4 : 8);
      }
    }

    // The authoritative direction is our aim vector (spread is re-applied server-side).
    this.onShoot?.({
      dir: { x: TMP_DIR.x, y: TMP_DIR.y, z: TMP_DIR.z },
      weapon: this.weaponId,
    });

    this.local.addRecoil(def.recoilPitch * (0.85 + Math.random() * 0.3), (Math.random() * 2 - 1) * def.recoilYaw);
    this.local.addShake(def.shake);
    this.local.addFovKick(def.fovKick);
    this.gunKick = Math.min(0.3, this.gunKick + def.kick);
    this.flashViewmodel();
    this.effects.spawnMuzzleFlash(muzzle, def.color, def.id === 'shotgun' ? 0.9 : 0.5);
    this.audio.playShoot(def.id);
    void endpoint;
    void hitAvatar;
    void hitAnimal;
  }

  traceShot(origin, dir, maxDist) {
    let bestT = maxDist;
    let avatar = null;
    let animal = null;
    for (const av of this.avatars.values()) {
      if (!av.target.alive) continue;
      const hit = rayHitsPlayer(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, av.target, bestT);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        avatar = av;
        animal = null;
      }
    }
    for (const target of this.animalField.list()) {
      const hit = rayHitsAnimal(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, target, bestT);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        avatar = null;
        animal = target;
      }
    }
    const wallT = rayHitsArena(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
    if (wallT < bestT) {
      bestT = wallT;
      avatar = null;
      animal = null;
    }
    if (dir.y < -1e-6) {
      const floorT = -origin.y / dir.y;
      if (floorT > 0 && floorT < bestT) {
        bestT = floorT;
        avatar = null;
        animal = null;
      }
    }
    const point = origin.clone().addScaledVector(dir, Math.max(0.5, bestT));
    return { point, avatar, animal, distance: bestT };
  }

  flashViewmodel() {
    if (!this.viewFlash) return;
    this.viewFlash.visible = true;
    this.viewFlash.material.opacity = 1;
    this.viewFlash.material.rotation = Math.random() * Math.PI;
    this.viewFlashTimer = 0.055;
  }

  sendMove(force = false) {
    if (!this.onMove) return;
    if (this.mode !== 'playing' || !this.local.alive) return;
    this.onMove({
      x: Math.round(this.local.x * 1000) / 1000,
      y: Math.round(this.local.y * 1000) / 1000,
      z: Math.round(this.local.z * 1000) / 1000,
      yaw: this.local.yaw,
      pitch: this.local.pitch,
    });
    if (force) this.moveAccumulator = 0;
  }

  // ------------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------------
  handleActionInput(now) {
    if (this.paused || this.mode === 'menu' || this.mode === 'ended' || this.mode === 'eliminated') {
      this.ui.showScoreboard(false);
      return;
    }
    const input = this.input;
    const showBoard = input.isDown('Tab');
    const boardVisible = !this.ui.scoreboardEl.classList.contains('hidden');
    if (showBoard !== boardVisible) {
      this.ui.showScoreboard(showBoard);
      if (showBoard) this.ui.updateScoreboard(this.latestPlayers, this.selfId);
    }
    if (this.mode !== 'playing') return;

    if (input.wasPressed('Digit1')) this.switchWeapon('pistol');
    if (input.wasPressed('Digit2')) this.switchWeapon('shotgun');
    if (input.wasPressed('Digit3')) this.switchWeapon('rifle');
    if (input.wasPressed('Digit4')) this.switchWeapon('smg');
    if (input.wasPressed('Digit5')) this.switchWeapon('dmr');
    if (input.wasPressed('KeyQ')) this.cycleWeapon(-1);
    if (input.wasPressed('KeyR')) this.reload();
    const wheel = input.consumeWheel();
    if (wheel !== 0) this.cycleWeapon(wheel > 0 ? 1 : -1);

    if (!this.local.alive) return;
    if (
      input.wasPressed('ControlLeft') ||
      input.wasPressed('ControlRight') ||
      input.wasPressed('KeyC')
    ) {
      this.useDodge();
    }
    const def = this.getWeapon();
    if (!this.reloading && def.auto && input.fireHeld) this.tryFire(now);
    else if (!this.reloading && !def.auto && input.firePressed) this.tryFire(now);
  }

  updateReload(now) {
    if (!this.reloading) return;
    const def = this.getWeapon();
    const progress = Math.min(1, (now - this.reloadStart) / Math.max(1, this.reloadEnd - this.reloadStart));
    this.ui.setReload(progress);
    if (progress >= 1) {
      this.reloading = false;
      this.mags[this.weaponId] = def.mag;
      this.ui.setReload(null);
      this.ui.setAmmo(this.mags[this.weaponId]);
    }
  }

  updateViewmodel(dt, now) {
    if (!this.gunRoot) return;
    const visible = this.mode === 'playing' && !this.paused;
    this.gunRoot.visible = visible;
    if (!visible) return;

    this.gunKick *= Math.exp(-dt * 13);
    const speedRatio = Math.min(1, this.local.speed / 11);
    const bob = this.local.grounded ? Math.sin(this.local.bobPhase * 2) * 0.012 * speedRatio : 0;
    const sway = Math.sin(this.clock * 1.4) * 0.006;
    const swayY = Math.cos(this.clock * 1.1) * 0.005;
    this.gunRoot.position.set(sway + bob * 0.6, swayY - bob, this.gunKick);
    this.gunRoot.rotation.z = bob * 0.6 + this.local.dodgeRoll * 1.6;
    this.gunRoot.rotation.x = this.gunKick * 1.5;
    this.gunRoot.rotation.y = -this.local.dodgeRoll * 0.8;

    if (this.reloading) {
      const p = Math.min(1, (now - this.reloadStart) / Math.max(1, this.reloadEnd - this.reloadStart));
      const dip = Math.sin(p * Math.PI);
      this.gunRoot.position.y -= dip * 0.12;
      this.gunRoot.position.z += dip * 0.05;
      this.gunRoot.rotation.x -= dip * 0.38;
      this.gunRoot.rotation.z += dip * 0.25;
    }

    if (this.viewFlashTimer > 0) {
      this.viewFlashTimer -= dt;
      this.viewFlash.material.opacity = Math.max(0, this.viewFlashTimer / 0.055);
      this.viewFlash.visible = true;
      const s = (this.weaponId === 'shotgun' ? 0.5 : 0.32) * (1 + (1 - this.viewFlashTimer / 0.055) * 0.8);
      this.viewFlash.scale.setScalar(s);
      if (this.viewFlashTimer <= 0) this.viewFlash.visible = false;
    }
  }

  updateCrosshair() {
    if (this.mode !== 'playing') return;
    const spread = this.ui.baseGap + Math.min(9, this.local.speed * 0.55) + this.local.recoilPitch * 60;
    this.ui.setCrosshairGap(spread);
  }

  updateDeathCamera(dt) {
    this.deathTilt = Math.min(1, this.deathTilt + dt * 2.2);
    const pos = this.deathCameraPos || this.camera.position;
    const rot = this.deathCameraRot || this.camera.rotation;
    this.camera.position.set(pos.x, pos.y - this.deathTilt * 1.15, pos.z);
    this.camera.rotation.x = rot.x - this.deathTilt * 0.22;
    this.camera.rotation.y = rot.y;
    this.camera.rotation.z = this.deathTilt * 0.5;
    if (this.camera.fov !== 80) {
      this.camera.fov = 80;
      this.camera.updateProjectionMatrix();
    }
  }

  updateSpectatorCamera(dt) {
    this.previewAngle += dt * 0.05;
    const r = 43;
    this.camera.position.set(Math.cos(this.previewAngle) * r, 25 + Math.sin(this.clock * 0.2) * 2, Math.sin(this.previewAngle) * r);
    this.camera.lookAt(0, 3.2, 0);
    if (this.camera.fov !== 62) {
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
    }
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.clock += dt;

    this.ui.tick(now);
    this.handleActionInput(now);
    if (this.mode === 'playing' || this.mode === 'dead') {
      this.ui.setDodge(this.local.dodgeReadyIn(performance.now()));
    }

    if (this.mode === 'menu') {
      this.previewAngle += dt * 0.07;
      const r = 46;
      this.camera.position.set(Math.cos(this.previewAngle) * r, 23 + Math.sin(this.clock * 0.25) * 2.5, Math.sin(this.previewAngle) * r);
      this.camera.lookAt(0, 4.5, 0);
    } else if (this.mode === 'eliminated') {
      this.updateSpectatorCamera(dt);
    } else if (this.mode === 'dead') {
      this.updateDeathCamera(dt);
    } else if (this.mode === 'playing' && this.local.alive) {
      const active = !this.paused;
      if (this.camera.fov > 76) {
        this.camera.fov = 76;
        this.camera.updateProjectionMatrix();
      }
      this.local.update(dt, this.input, active);
      this.updateReload(now);
      this.updateCrosshair();

      this.moveAccumulator += dt;
      if (this.moveAccumulator >= 0.05) {
        this.sendMove();
        this.moveAccumulator = 0;
      }
    } else if (this.mode === 'ended') {
      // Let the world breathe behind the results panel.
      if (this.camera.fov !== 66) {
        this.camera.fov = 66;
        this.camera.updateProjectionMatrix();
      }
      this.camera.position.y += Math.sin(this.clock * 0.6) * dt * 0.15;
    }

    this.world.update(dt, this.clock);
    this.effects.update(dt);
    this.animalField.update(dt, this.clock);
    for (const av of this.avatars.values()) av.update(dt, this.camera, this.clock);
    this.updateViewmodel(dt, now);

    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.mode !== 'menu' && this.gunRoot && this.gunRoot.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCamera);
    }

    this.input.endFrame();
  }
}
