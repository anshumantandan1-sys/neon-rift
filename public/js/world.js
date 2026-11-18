import * as THREE from 'three';
import { ARENA_HALF, ARENA_SIZE, OBSTACLES, SPAWNS, hashSeed } from './arena.js';

/**
 * Countryside arena art pass.
 * Everything is procedural: no external textures, models or audio.
 */

function canvasTexture(size, draw, { repeat = 1, aniso = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  return tex;
}

function grassTexture() {
  return canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = '#5b853c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 2600; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const shade = 70 + Math.random() * 60;
        ctx.fillStyle = `rgba(${40 + shade * 0.35}, ${shade + 30}, ${40 + shade * 0.2}, ${0.18 + Math.random() * 0.35})`;
        ctx.fillRect(x, y, 2 + Math.random() * 5, 1 + Math.random() * 3);
      }
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.strokeStyle = `rgba(${100 + Math.random() * 60}, ${150 + Math.random() * 60}, ${70 + Math.random() * 40}, 0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() * 2 - 1) * 5, y - 4 - Math.random() * 7);
        ctx.stroke();
      }
    },
    { repeat: 46, aniso: 8 },
  );
}

function dirtTexture() {
  return canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 2200; i++) {
        const shade = 60 + Math.random() * 80;
        ctx.fillStyle = `rgba(${shade + 40}, ${shade + 10}, ${shade * 0.6}, 0.5)`;
        const r = Math.random() * 2.4;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(90, 64, 38, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        const y = Math.random() * size;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + 12, size * 0.6, y - 10, size, y + 4);
        ctx.stroke();
      }
    },
    { repeat: 8, aniso: 8 },
  );
}

function woodTexture() {
  return canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#8a4b33';
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 26) {
        ctx.fillStyle = `rgba(40, 20, 12, ${0.14 + Math.random() * 0.12})`;
        ctx.fillRect(x, 0, 3, size);
        ctx.fillStyle = `rgba(255, 210, 160, ${0.05 + Math.random() * 0.05})`;
        ctx.fillRect(x + 4, 0, 6, size);
      }
      for (let i = 0; i < 130; i++) {
        ctx.strokeStyle = 'rgba(50, 26, 16, 0.22)';
        ctx.lineWidth = 1;
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 6, y + 10, x - 4, y + 22, x + 3, y + 34);
        ctx.stroke();
      }
    },
    { repeat: 1, aniso: 4 },
  );
}

function stoneTexture() {
  return canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#8d8b80';
      ctx.fillRect(0, 0, size, size);
      const rows = 5;
      const h = size / rows;
      for (let r = 0; r < rows; r++) {
        let x = (r % 2) * -22;
        while (x < size) {
          const w = 34 + Math.random() * 26;
          const g = 120 + Math.random() * 50;
          ctx.fillStyle = `rgb(${g}, ${g - 4}, ${g - 14})`;
          ctx.fillRect(x + 2, r * h + 2, w - 3, h - 3);
          ctx.strokeStyle = 'rgba(70, 68, 60, 0.45)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, r * h + 2, w - 3, h - 3);
          x += w;
        }
      }
    },
    { repeat: 3, aniso: 4 },
  );
}

function makeSky() {
  const geo = new THREE.SphereGeometry(290, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f6fb8) },
      midColor: { value: new THREE.Color(0x8ec4ee) },
      bottomColor: { value: new THREE.Color(0xe6f2ee) },
      sunColor: { value: new THREE.Color(0xfff3cf) },
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
      uniform vec3 bottomColor;
      uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.05, 0.35, h));
        col = mix(col, topColor, smoothstep(0.25, 0.95, h));
        vec3 sunDir = normalize(vec3(0.55, 0.62, 0.42));
        float sun = pow(max(dot(vDir, sunDir), 0.0), 380.0);
        float halo = pow(max(dot(vDir, sunDir), 0.0), 9.0);
        col += sunColor * (sun * 1.4 + halo * 0.16);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function cloudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 16; i++) {
    const x = 40 + Math.random() * 176;
    const y = 96 + Math.random() * 72;
    const r = 26 + Math.random() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c3823';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.fillStyle = 'rgba(30, 16, 8, 0.35)';
    ctx.fillRect(x, 0, 5, canvas.height);
  }
  ctx.strokeStyle = '#2c170d';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4e4bd';
  ctx.font = '900 132px Georgia, "Times New Roman", serif';
  ctx.fillText(text, canvas.width / 2, 168);
  ctx.font = '700 52px Georgia, serif';
  ctx.fillStyle = '#e3c689';
  ctx.fillText(sub, canvas.width / 2, 282);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoad() {
  const points = [
    new THREE.Vector3(-34, 0, 27),
    new THREE.Vector3(-26, 0, 22),
    new THREE.Vector3(-18, 0, 12),
    new THREE.Vector3(-11, 0, 8),
    new THREE.Vector3(-4, 0, 11),
    new THREE.Vector3(5, 0, 9),
    new THREE.Vector3(11, 0, 2),
    new THREE.Vector3(15, 0, -8),
    new THREE.Vector3(22, 0, -16),
    new THREE.Vector3(28, 0, -25),
    new THREE.Vector3(34, 0, -31),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const samples = 160;
  const halfWidth = 1.9;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const wobble = Math.sin(t * 22) * 0.28;
    positions.push(p.x + nx * (halfWidth + wobble), 0.035, p.z + nz * (halfWidth + wobble));
    positions.push(p.x - nx * (halfWidth + wobble), 0.035, p.z - nz * (halfWidth + wobble));
    uvs.push(t * 26, 0, t * 26, 1);
    if (i < samples) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const tex = dirtTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
  });
  const road = new THREE.Mesh(geo, mat);
  road.receiveShadow = true;
  return road;
}

function makeTree(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d26, roughness: 0.95, flatShading: true });
  const leafPalette = [0x3f6f2e, 0x4c7d35, 0x35632a, 0x578a3b];
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 3.6, 6), trunkMat);
  trunk.position.y = 1.8;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({
    color: leafPalette[Math.floor(rng() * leafPalette.length)],
    roughness: 0.82,
    flatShading: true,
  });
  for (let i = 0; i < 4; i++) {
    const r = 1.5 - i * 0.22;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
    blob.position.set((rng() - 0.5) * 0.9, 3.5 + i * 0.55, (rng() - 0.5) * 0.9);
    blob.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

function makeFenceRails(obstacles) {
  const postGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a6136, roughness: 0.86 });

  let postCount = 0;
  for (const o of obstacles) {
    const span = Math.max(o.w, o.d);
    postCount += Math.max(2, Math.round(span / 2.2) + 1);
  }
  const posts = new THREE.InstancedMesh(postGeo, postMat, postCount);
  posts.castShadow = true;
  posts.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let idx = 0;

  for (const o of obstacles) {
    const alongX = o.w >= o.d;
    const span = alongX ? o.w : o.d;
    const n = Math.max(2, Math.round(span / 2.2) + 1);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = alongX ? o.x - o.w / 2 + o.w * t : o.x;
      const z = alongX ? o.z : o.z - o.d / 2 + o.d * t;
      dummy.position.set(x, o.h * 0.5, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, o.h, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(idx++, dummy.matrix);
    }
    for (const level of [0.45, 0.82]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? o.w : 0.1, 0.11, alongX ? 0.1 : o.d),
        railMat,
      );
      rail.position.set(o.x, o.h * level, o.z);
      rail.castShadow = true;
      // Rails are added by the caller via `rail.parent` hook below.
      rail.userData.railOf = o.kind;
      posts.userData.rails = posts.userData.rails || [];
      posts.userData.rails.push(rail);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  return { posts, rails: posts.userData.rails || [] };
}

function makeBarn(woodTex) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb85a45, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4f56, roughness: 0.8, metalness: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4.6, 9), wallMat);
  body.position.y = 2.3;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Gable.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-6, 0);
  gableShape.lineTo(6, 0);
  gableShape.lineTo(0, 2.3);
  gableShape.lineTo(-6, 0);
  const gable = new THREE.Mesh(
    new THREE.ExtrudeGeometry(gableShape, { depth: 0.4, bevelEnabled: false }),
    wallMat,
  );
  gable.position.set(0, 4.6, -4.2);
  gable.castShadow = true;
  group.add(gable);

  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 9.8), roofMat);
    roof.position.set(side * 3.1, 5.55, 0);
    roof.rotation.z = side * 0.52;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
  }

  // Big sliding door with white cross-brace.
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 3.5, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x5a2f21, roughness: 0.9 }),
  );
  door.position.set(0, 1.75, 4.56);
  group.add(door);
  for (const side of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 0.2), trimMat);
    brace.position.set(side * 1.85, 2.2, 4.6);
    group.add(brace);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 0.2), trimMat);
  lintel.position.set(0, 3.9, 4.62);
  group.add(lintel);

  // Warm windows.
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcf87, transparent: true, opacity: 0.85 });
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), glowMat);
    win.position.set(side * 4.1, 2.7, 4.53);
    group.add(win);
  }

  // Sign above the door.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.58),
    new THREE.MeshBasicMaterial({ map: signTexture('RIFT RANCH', 'EST. 2087 · NO TRESPASSING') }),
  );
  sign.position.set(0, 5.1, 4.58);
  group.add(sign);

  return group;
}

function makeSilo() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa1a4, roughness: 0.5, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 18), metal);
  body.position.y = 4;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.02, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7f878c, roughness: 0.45, metalness: 0.6 }),
  );
  dome.position.y = 8;
  dome.castShadow = true;
  group.add(dome);

  for (let i = 1; i <= 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.03, 0.05, 6, 24), metal);
    band.rotation.x = Math.PI / 2;
    band.position.y = i * 2;
    group.add(band);
  }
  return group;
}

function makeWindmill() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d4b2e, roughness: 0.9 });
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 8.6, 6), wood);
    leg.position.set(sx * 1.05, 4.3, sz * 1.05);
    leg.rotation.z = sx * 0.06;
    leg.rotation.x = -sz * 0.06;
    leg.castShadow = true;
    group.add(leg);
  }
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, 1.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x4c4a44, roughness: 0.8 }),
  );
  cap.position.y = 9.1;
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  group.add(cap);

  const blades = new THREE.Group();
  blades.position.set(0, 8.4, 1.4);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.4, 0.08), bladeMat);
    blade.position.y = 1.8;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    holder.add(blade);
    blades.add(holder);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), wood);
  blades.add(hub);
  group.add(blades);
  return { group, blades };
}

function makePond() {
  const group = new THREE.Group();
  const shore = new THREE.Mesh(
    new THREE.CircleGeometry(7.1, 40),
    new THREE.MeshStandardMaterial({ color: 0x8f7f5e, roughness: 1 }),
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.02;
  shore.scale.set(1, 0.68, 1);
  group.add(shore);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f6f83,
    roughness: 0.12,
    metalness: 0.45,
    transparent: true,
    opacity: 0.86,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  water.scale.set(1, 0.66, 1);
  group.add(water);

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x5f7a34, roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 6.3 + Math.random() * 0.9;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9 + Math.random() * 0.6, 4), reedMat);
    reed.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r * 0.66);
    reed.rotation.z = (Math.random() - 0.5) * 0.25;
    group.add(reed);
  }
  return { group, waterMat };
}

function makeScarecrow() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x9b6b3f, roughness: 0.95 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), wood);
  pole.position.y = 1.3;
  group.add(pole);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.1), wood);
  arms.position.y = 1.95;
  arms.rotation.z = 0.12;
  group.add(arms);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.32), cloth);
  torso.position.y = 1.72;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), cloth);
  head.position.y = 2.35;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.34, 10), wood);
  hat.position.y = 2.58;
  group.add(hat);
  return group;
}

function makeRuin(stoneTex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xbdb9ac, roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.55, 6), mat);
  base.position.y = 0.27;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const walls = [
    { x: 0, z: -2.7, w: 6, h: 2.6 },
    { x: 0, z: 2.7, w: 6, h: 1.7 },
    { x: -2.7, z: 0, w: 0.55, h: 2.3, d: 5.4 },
    { x: 2.7, z: 0, w: 0.55, h: 2.0, d: 5.4 },
  ];
  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d || 0.55), mat);
    mesh.position.set(w.x, 0.55 + w.h / 2, w.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Toppled stones.
  for (let i = 0; i < 6; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.3, 0), mat);
    stone.position.set((Math.random() - 0.5) * 7, 0.18, (Math.random() - 0.5) * 7);
    stone.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    group.add(stone);
  }
  return group;
}

export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0xcfe2ee, 78, 250);
  scene.background = new THREE.Color(0xbfe0f2);

  const root = new THREE.Group();
  root.name = 'countryside';
  scene.add(root);

  root.add(makeSky());

  // ---------- Lighting ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.26));
  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x6d8b4d, 0.65));

  const key = new THREE.DirectionalLight(0xfff1d6, 2.5);
  key.position.set(46, 68, 34);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -56;
  key.shadow.camera.right = 56;
  key.shadow.camera.top = 56;
  key.shadow.camera.bottom = -56;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 190;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  scene.add(key.target);

  const bounce = new THREE.DirectionalLight(0xffd7a1, 0.28);
  bounce.position.set(-40, 24, -30);
  scene.add(bounce);

  // ---------- Ground ----------
  const grass = grassTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320, 1, 1),
    new THREE.MeshStandardMaterial({ map: grass, color: 0xffffff, roughness: 0.98, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  root.add(makeRoad());

  // Rolling hills outside the fence.
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x4f7a37, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + hashSeed(i) * 0.5;
    const dist = 62 + hashSeed(i * 3) * 55;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(12 + hashSeed(i * 7) * 16, 10, 7), hillMat);
    hill.position.set(Math.cos(a) * dist, -5.5, Math.sin(a) * dist);
    hill.scale.set(1, 0.36 + hashSeed(i * 5) * 0.2, 1);
    root.add(hill);
  }

  // ---------- Distant tree line ----------
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 5);
  const canopyGeo = new THREE.ConeGeometry(2.4, 6.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3c6a2c, roughness: 0.95, flatShading: true });
  const TREES = 150;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, TREES);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < TREES; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 44 + Math.random() * 62;
    const s = 0.7 + Math.random() * 0.9;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    dummy.position.set(x, 1.6 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.4 * s, z);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  root.add(trunks, canopies);

  // ---------- Grass tufts ----------
  const tuftGeo = new THREE.ConeGeometry(0.07, 0.42, 3);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x7fa24b, roughness: 1 });
  const TUFTS = 520;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
  const tuftColor = new THREE.Color();
  for (let i = 0; i < TUFTS; i++) {
    const x = (Math.random() * 2 - 1) * 32;
    const z = (Math.random() * 2 - 1) * 32;
    dummy.position.set(x, 0.18, z);
    dummy.scale.set(1, 0.7 + Math.random() * 0.9, 1);
    dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tuftColor.setHSL(0.24 + Math.random() * 0.06, 0.42, 0.32 + Math.random() * 0.16);
    tufts.setColorAt(i, tuftColor);
  }
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  root.add(tufts);

  // ---------- Static obstacle art ----------
  const woodTex = woodTexture();
  const stoneTex = stoneTexture();
  const barn = makeBarn(woodTex);
  barn.position.set(-22, 0, -19);
  root.add(barn);

  const silo = makeSilo();
  silo.position.set(-31, 0, -21);
  root.add(silo);

  const windmill = makeWindmill();
  windmill.group.position.set(25, 0, -26);
  root.add(windmill.group);

  const ruin = makeRuin(stoneTex);
  root.add(ruin);

  const pond = makePond();
  pond.group.position.set(17, 0, 21);
  root.add(pond.group);

  const scarecrow = makeScarecrow();
  scarecrow.position.set(-3, 0, 27);
  scarecrow.rotation.y = 0.4;
  root.add(scarecrow);

  // Fence posts + rails for every 'fence' obstacle.
  const fenceParts = makeFenceRails(OBSTACLES.filter((o) => o.kind === 'fence'));
  root.add(fenceParts.posts);
  for (const rail of fenceParts.rails) root.add(rail);

  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.95 });
  const hayBandMat = new THREE.MeshStandardMaterial({ color: 0x8d6b32, roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xc9a06d, roughness: 0.92 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8d86, roughness: 0.95, flatShading: true });

  for (const o of OBSTACLES) {
    if (o.kind === 'fence' || o.kind === 'barn' || o.kind === 'silo' || o.kind === 'windmill' || o.kind === 'ruin') continue;

    if (o.kind === 'hay') {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(o.h * 0.55, o.h * 0.55, Math.max(o.w, o.d) - 0.2, 14), hayMat);
      bale.rotation.z = Math.PI / 2;
      bale.position.set(o.x, o.h * 0.55, o.z);
      bale.castShadow = true;
      bale.receiveShadow = true;
      root.add(bale);
      for (const off of [-0.3, 0.3]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(o.h * 0.56, 0.035, 5, 18), hayBandMat);
        band.position.set(o.x + (o.w >= o.d ? off * Math.max(o.w, o.d) : 0), o.h * 0.55, o.z + (o.w >= o.d ? 0 : off * Math.max(o.w, o.d)));
        band.rotation.y = o.w >= o.d ? 0 : Math.PI / 2;
        root.add(band);
      }
    } else if (o.kind === 'crate') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), crateMat);
      crate.position.set(o.x, o.h / 2, o.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      root.add(crate);
      for (const s of [-1, 1]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(o.w * 1.02, 0.08, 0.06), hayBandMat);
        brace.position.set(o.x, o.h / 2, o.z + (o.d / 2 + 0.03) * s);
        brace.rotation.z = 0.7;
        root.add(brace);
      }
    } else if (o.kind === 'trough') {
      const trough = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), crateMat);
      trough.position.set(o.x, o.h / 2, o.z);
      trough.castShadow = true;
      trough.receiveShadow = true;
      root.add(trough);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(o.w - 0.3, o.d - 0.3),
        new THREE.MeshStandardMaterial({ color: 0x3a7488, roughness: 0.15, metalness: 0.4 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(o.x, o.h - 0.08, o.z);
      root.add(water);
    } else if (o.kind === 'stonewall') {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xb9b5a8, roughness: 0.95 }));
      wall.position.set(o.x, o.h / 2, o.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);
    } else if (o.kind === 'rock') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(o.w, o.d) * 0.55, 0), rockMat);
      rock.position.set(o.x, o.h * 0.4, o.z);
      rock.scale.set(1, o.h / (Math.max(o.w, o.d) * 0.6), 1);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      root.add(rock);
    } else if (o.kind === 'tree') {
      const tree = makeTree(() => Math.random());
      tree.position.set(o.x, 0, o.z);
      tree.scale.setScalar(1.05 + hashSeed(o.x * 7 + o.z) * 0.35);
      root.add(tree);
    }
  }

  // Playable-area marker rings: trampled dirt where fighters deploy.
  const padMat = new THREE.MeshBasicMaterial({
    color: 0x7a5c37,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const s of SPAWNS) {
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.55, 28), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.x, 0.045, s.z);
    root.add(pad);
  }

  // ---------- Clouds ----------
  const cloudTex = cloudTexture();
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
    );
    const a = (i / 9) * Math.PI * 2 + Math.random();
    const dist = 90 + Math.random() * 120;
    sprite.position.set(Math.cos(a) * dist, 62 + Math.random() * 28, Math.sin(a) * dist);
    sprite.scale.set(56 + Math.random() * 40, 22 + Math.random() * 14, 1);
    root.add(sprite);
    clouds.push({ sprite, speed: 0.4 + Math.random() * 0.6, baseX: sprite.position.x });
  }

  // ---------- Fence-line props ----------
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), postMat);
    post.position.set(-30 + i * 2.4, 0.8, 33.8);
    root.add(post);
  }

  return {
    root,
    lights: { key },
    update(dt, elapsed) {
      windmill.blades.rotation.z += dt * 0.85;
      pond.waterMat.opacity = 0.8 + Math.sin(elapsed * 1.6) * 0.05;
      for (const c of clouds) {
        c.sprite.position.x = c.baseX + Math.sin(elapsed * 0.02 * c.speed + c.baseX) * 26;
      }
    },
  };
}
