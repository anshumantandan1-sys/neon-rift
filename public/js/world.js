import * as THREE from 'three';
import { ARENA_HALF, ARENA_SIZE, OBSTACLES, SPAWNS } from './arena.js';

const STYLE = {
  wall: { base: 0x0a0e1e, trim: 0x2a6bff, rough: 0.5, metal: 0.55 },
  crate: { base: 0x121a33, trim: 0x00e5ff, rough: 0.4, metal: 0.65 },
  barrier: { base: 0x1a0f30, trim: 0xff2bd6, rough: 0.35, metal: 0.7 },
  tower: { base: 0x120a28, trim: 0xb14bff, rough: 0.3, metal: 0.8 },
  pillar: { base: 0x101a2e, trim: 0x00ffc8, rough: 0.4, metal: 0.7 },
  pylon: { base: 0x0e1a28, trim: 0x5affd8, rough: 0.35, metal: 0.75 },
};

function neonBannerTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 118px "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = color;
  ctx.shadowBlur = 45;
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 132);
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '900 112px "Segoe UI", Arial, sans-serif';
  ctx.fillText(text, 512, 132);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 30, 948, 196);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function floorTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#101a3d');
  grad.addColorStop(0.45, '#0a0f26');
  grad.addColorStop(1, '#05060f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(72, 124, 255, 0.16)';
  ctx.lineWidth = 2;
  const step = size / 16;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
  ctx.lineWidth = 4;
  for (let r = 160; r <= 480; r += 160) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(210, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x05010f) },
      midColor: { value: new THREE.Color(0x1a0733) },
      horizonColor: { value: new THREE.Color(0x46137a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.48, 0.62, h));
        col = mix(col, topColor, smoothstep(0.62, 0.95, h));
        float glow = pow(max(0.0, 1.0 - abs(vDir.y) * 5.0), 3.0);
        col += vec3(0.18, 0.04, 0.32) * glow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function makeStarfield() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0x9fd8ff), new THREE.Color(0xffffff), new THREE.Color(0xd7a7ff), new THREE.Color(0x7dfff1)];
  for (let i = 0; i < count; i++) {
    const r = 120 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 1.35 - 0.35);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * r * 0.8 + 6;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0x0a0618, 0.0125);
  scene.background = new THREE.Color(0x05010f);

  const root = new THREE.Group();
  root.name = 'arena';
  scene.add(root);

  root.add(makeSky());
  root.add(makeStarfield());

  // ---------- Lighting ----------
  scene.add(new THREE.AmbientLight(0x7060ff, 0.55));
  const hemi = new THREE.HemisphereLight(0x4d2bff, 0x05060f, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xb9d7ff, 1.9);
  key.position.set(27, 46, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -44;
  key.shadow.camera.right = 44;
  key.shadow.camera.top = 44;
  key.shadow.camera.bottom = -44;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 110;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  scene.add(key);

  const reactorLight = new THREE.PointLight(0xc44bff, 260, 52, 2);
  reactorLight.position.set(0, 5.4, 0);
  scene.add(reactorLight);
  const cyanLight = new THREE.PointLight(0x00e5ff, 140, 40, 2);
  cyanLight.position.set(-22, 6, -22);
  scene.add(cyanLight);
  const magentaLight = new THREE.PointLight(0xff2bd6, 140, 40, 2);
  magentaLight.position.set(22, 6, 22);
  scene.add(magentaLight);
  const greenLight = new THREE.PointLight(0x5affd8, 110, 38, 2);
  greenLight.position.set(22, 6, -22);
  scene.add(greenLight);
  const orangeLight = new THREE.PointLight(0xff8a3d, 90, 34, 2);
  orangeLight.position.set(-22, 6, 22);
  scene.add(orangeLight);

  // ---------- Floor ----------
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture(),
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.45,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE + 4, ARENA_SIZE + 4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(ARENA_SIZE, 35, 0x2f5bff, 0x14224a);
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  root.add(grid);

  // Cyan pad under the arena to hide the horizon edge.
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_HALF + 3, ARENA_HALF + 3, 0.6, 64),
    new THREE.MeshStandardMaterial({ color: 0x080b18, metalness: 0.6, roughness: 0.4 }),
  );
  skirt.position.y = -0.32;
  root.add(skirt);

  const glowRingMat = new THREE.MeshBasicMaterial({
    color: 0x2bd8ff,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const centerRing = new THREE.Mesh(new THREE.RingGeometry(9.4, 9.62, 80), glowRingMat);
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.035;
  root.add(centerRing);
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(16.4, 16.6, 96), glowRingMat.clone());
  outerRing.material.color.set(0xff2bd6);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.035;
  root.add(outerRing);

  // ---------- Static obstacles ----------
  const animated = [];
  const strips = [];

  for (const o of OBSTACLES) {
    const style = STYLE[o.kind] || STYLE.crate;
    const geo = new THREE.BoxGeometry(o.w, o.h, o.d);
    const mat = new THREE.MeshStandardMaterial({
      color: style.base,
      metalness: style.metal,
      roughness: style.rough,
      emissive: new THREE.Color(style.trim).multiplyScalar(o.kind === 'tower' ? 0.28 : 0.08),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(o.x, o.h / 2, o.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    // Bright edge outline.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: style.trim, transparent: true, opacity: 0.85 }),
    );
    edges.position.copy(mesh.position);
    root.add(edges);

    // Neon cap.
    const capMat = new THREE.MeshBasicMaterial({
      color: style.trim,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.06, 0.07, o.d + 0.06), capMat);
    cap.position.set(o.x, o.h + 0.035, o.z);
    root.add(cap);
    strips.push(capMat);
    animated.push({ type: 'strip', mat: capMat, phase: Math.random() * Math.PI * 2 });

    if (o.kind === 'crate') {
      const panelMat = new THREE.MeshBasicMaterial({
        color: style.trim,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.55, o.h * 0.45), panelMat);
      panel.position.set(o.x, o.h * 0.55, o.z + o.d / 2 + 0.02);
      root.add(panel);
      animated.push({ type: 'strip', mat: panelMat, phase: Math.random() * Math.PI * 2 });
    }

    if (o.kind === 'tower') {
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 5.8, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xd77bff,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      core.position.set(0, 2.9, 0);
      root.add(core);
      animated.push({ type: 'core', mesh: core });

      for (let i = 0; i < 3; i++) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: i === 1 ? 0x00e5ff : 0xd77bff,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7 + i * 0.4, 0.045, 8, 60), ringMat);
        ring.rotation.x = Math.PI / 2 + i * 0.4;
        ring.rotation.z = i * 0.8;
        ring.position.y = 2.2 + i * 1.1;
        root.add(ring);
        animated.push({ type: 'ring', mesh: ring, speed: 0.35 + i * 0.22, dir: i % 2 ? -1 : 1 });
      }
    }

    if (o.kind === 'pylon') {
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x5affd8,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.9, 16, 8, 1, true), beamMat);
      beam.position.set(o.x, o.h + 8, o.z);
      root.add(beam);
      animated.push({ type: 'beam', mat: beamMat, phase: Math.random() * 6 });
    }
  }

  // ---------- Spawn pads ----------
  for (const s of SPAWNS) {
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x35f0ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.62, 40), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.x, 0.04, s.z);
    root.add(pad);
    animated.push({ type: 'pad', mat: padMat, phase: Math.random() * Math.PI * 2 });

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 24),
      new THREE.MeshBasicMaterial({
        color: 0xa8f6ff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(s.x, 0.045, s.z);
    root.add(inner);
  }

  // ---------- Wall banners ----------
  const banners = [
    { text: 'NEON RIFT', color: '#33d6ff', x: 0, y: 4.3, z: -34.35, rot: 0 },
    { text: 'RIFT ARENA', color: '#ff3ddc', x: 0, y: 4.3, z: 34.35, rot: Math.PI },
    { text: 'SECTOR 07', color: '#7dff6b', x: -34.35, y: 4.3, z: 0, rot: Math.PI / 2 },
    { text: 'OVERDRIVE', color: '#ffb03d', x: 34.35, y: 4.3, z: 0, rot: -Math.PI / 2 },
  ];
  for (const b of banners) {
    const tex = neonBannerTexture(b.text, b.color);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 3.25),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    plane.position.set(b.x, b.y, b.z);
    plane.rotation.y = b.rot;
    root.add(plane);
  }

  // ---------- Floating decor ----------
  const floaters = [];
  const ringColors = [0x00e5ff, 0xff2bd6, 0x8b5cff, 0x5affd8];
  for (let i = 0; i < 7; i++) {
    const radius = 5 + Math.random() * 6;
    const mat = new THREE.MeshBasicMaterial({
      color: ringColors[i % ringColors.length],
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 72), mat);
    const angle = (i / 7) * Math.PI * 2;
    torus.position.set(Math.cos(angle) * 27, 11 + Math.random() * 8, Math.sin(angle) * 27);
    torus.rotation.x = Math.random() * Math.PI;
    torus.rotation.y = Math.random() * Math.PI;
    root.add(torus);
    floaters.push({ mesh: torus, spin: 0.05 + Math.random() * 0.12, phase: Math.random() * 6, baseY: torus.position.y });
  }

  for (let i = 0; i < 12; i++) {
    const size = 0.3 + Math.random() * 0.8;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2240,
      emissive: new THREE.Color(ringColors[i % ringColors.length]),
      emissiveIntensity: 1.6,
      metalness: 0.7,
      roughness: 0.3,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 20;
    cube.position.set(Math.cos(angle) * dist, 4 + Math.random() * 14, Math.sin(angle) * dist);
    root.add(cube);
    floaters.push({ mesh: cube, spin: 0.3 + Math.random() * 0.5, phase: Math.random() * 6, baseY: cube.position.y });
  }

  // Giant distant holo-rings for depth beyond the walls.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff2bd6 : 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14 + i * 2, 0.22, 8, 80), mat);
    ring.position.set(Math.cos(angle) * 62, 18 + i * 3, Math.sin(angle) * 62);
    ring.lookAt(0, 14, 0);
    root.add(ring);
    floaters.push({ mesh: ring, spin: 0.03 + i * 0.01, phase: i, baseY: ring.position.y });
  }

  const time = { value: 0 };
  return {
    root,
    lights: { key, reactorLight, cyanLight, magentaLight, greenLight, orangeLight },
    update(dt, elapsed) {
      time.value = elapsed;
      const t = elapsed;
      for (const a of animated) {
        if (a.type === 'strip') {
          a.mat.opacity = 0.55 + Math.sin(t * 2.2 + a.phase) * 0.22;
        } else if (a.type === 'ring') {
          a.mesh.rotation.z += dt * a.speed * a.dir;
          a.mesh.rotation.y += dt * 0.15 * a.dir;
        } else if (a.type === 'core') {
          const s = 1 + Math.sin(t * 3.2) * 0.06;
          a.mesh.scale.set(s, 1, s);
          a.mesh.material.opacity = 0.5 + Math.sin(t * 4.1) * 0.15;
        } else if (a.type === 'beam') {
          a.mat.opacity = 0.1 + Math.abs(Math.sin(t * 1.4 + a.phase)) * 0.12;
        } else if (a.type === 'pad') {
          a.mat.opacity = 0.32 + (Math.sin(t * 3 + a.phase) * 0.5 + 0.5) * 0.5;
        }
      }
      for (const f of floaters) {
        f.mesh.rotation.y += dt * f.spin;
        f.mesh.rotation.x += dt * f.spin * 0.35;
        f.mesh.position.y = f.baseY + Math.sin(t * 0.9 + f.phase) * 0.8;
      }
      reactorLight.intensity = 240 + Math.sin(t * 3.4) * 60;
      cyanLight.intensity = 130 + Math.sin(t * 1.8) * 30;
      magentaLight.intensity = 130 + Math.sin(t * 2.3 + 1) * 30;
    },
  };
}
