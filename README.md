# ⚡ NEON RIFT

**A fast, vibrant, real-time multiplayer 3D arena shooter that runs in the browser.**

Built for 10–15 year olds (and anyone who loves neon chaos): five-minute deathmatches, three outlandish weapons, synthwave bots, particle explosions and a glowing arena — no installs, no downloads, just click and play.

> **Tech:** Three.js (WebGL) on the client · Node.js + Express + Socket.io on the server · fully server-authoritative hit registration.

---

## ✨ Features

| | |
|---|---|
| **Instant multiplayer** | Quick Play auto-matchmaking or join with a room code (`NR-XXXX`). Up to 8 humans per room. |
| **Bots keep it lively** | Smart AI bots fill empty slots (up to 4 total per arena) and scale away as real players join. |
| **Three weapon classes** | Pulse Pistol (rapid semi-auto), Nova Shotgun (9-pellet spread), Ion Rifle (full-auto). |
| **Juicy feedback** | Recoil kick, view-model animations, muzzle flashes, tracers, impact sparks, kill bursts, screen shake, FOV punch, dynamic crosshairs, hitmarkers and damage numbers. |
| **100% synthesized audio** | Every shot, hit, footstep, reload and UI blip is generated with the Web Audio API — zero audio assets. |
| **Neon low-poly arena** | 70 × 70 m arena with cover crates, energy barriers, a reactor tower, animated pylons, holo-rings, stars and a 5-light rig. |
| **Live match HUD** | Health, ammo, weapon slots, kills/deaths, streak, match clock, room code, kill feed, notices. Hold **Tab** for the live scoreboard. |
| **Polished flow** | Attract-mode menu, callsigns, room codes, settings, pause menu, death screen with respawn timer, end-of-match results and auto-restart. |
| **Server-authoritative** | Server simulates hitscan bullets, validates fire rate, clamps movement speed, resolves collisions and owns health, kills and scores. |
| **Cloud-ready** | `process.env.PORT` binding, `/health` endpoint, graceful shutdown, Dockerfile, no database required. |

---

## 🚀 Quick start (local development)

**Requirements:** Node.js **18+** and a desktop browser with WebGL (Chrome, Edge, Firefox, Safari).

```bash
npm install
npm start
```

Open **http://localhost:3000**.

To play with a friend on the same Wi-Fi network, open `http://<your-lan-ip>:3000` on the second device and use the same room code (or just Quick Play — you'll land in the same arena if the room has space). The server prints its local address on startup.

### Useful scripts

| Command | What it does |
|---|---|
| `npm start` | Production-style start (`node server/index.js`). |
| `npm run dev` | Auto-restart the server on file changes (`node --watch`). |
| `npm run smoke` | Runs 29 deterministic server-logic checks (hit registration, kills, respawns, spawn shields, bots, match lifecycle). |
| `npm run check` | Syntax check the server entry point. |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket port. Cloud platforms set this automatically. |
| `HOST` | `0.0.0.0` | Bind address. Leave default for containers/PaaS. |

```bash
PORT=8080 npm start        # bash
$env:PORT=8080; npm start  # PowerShell
```

---

## 🎮 How to play

### Controls

| Input | Action |
|---|---|
| **W A S D** | Move |
| **Mouse** | Aim |
| **Left click** | Fire |
| **Shift** | Sprint (wider FOV, faster strafe) |
| **Space** | Jump |
| **1 / 2 / 3** | Pulse Pistol / Nova Shotgun / Ion Rifle |
| **Mouse wheel** / **Q** | Cycle weapons |
| **R** | Reload |
| **Tab** (hold) | Live scoreboard |
| **Esc** | Pause / release cursor |
| **Click arena** | Lock the mouse cursor |

### Weapons

| Weapon | Damage | Fire rate | Magazine | Notes |
|---|---|---|---|---|
| **Pulse Pistol** | 23 | 145 ms | 14 | Precise semi-auto, low recoil. Headshots ×2. |
| **Nova Shotgun** | 11 × 9 pellets | 860 ms | 6 | Devastating up close, wide crosshair. |
| **Ion Rifle** | 13 | 105 ms | 32 | Full-auto all-rounder. Headshots ×2. |

Headshots deal double damage (shotgun ×1.6). Health regenerates after ~5 seconds out of combat. Freshly deployed fighters get a **2-second spawn shield** (shown in the HUD). Bots fire in bursts, aim with human-like spread and deal slightly reduced damage so fights stay fair. First to the most kills when the **5-minute** timer runs out wins; the arena auto-restarts after the results screen.

### Rooms

* **Quick Play** finds the busiest open room or creates a fresh one.
* Enter a **room code** to join a specific arena. Codes are 2–10 letters/numbers.
* Click the room chip in the HUD to copy the code and share it.
* Bots are added/removed automatically so the arena always has about four fighters until humans fill it.

---

## 🗂 Project structure

```
.
├── server/
│   ├── index.js          # Express + Socket.io bootstrap, static hosting, /health, graceful shutdown
│   ├── rooms.js          # Room manager, game loop, validation, hitscan, bots, match lifecycle
│   └── config.js         # Server tuning: weapons, match duration, bot fill, speeds
├── public/
│   ├── index.html        # Menus, HUD, overlays (all screens)
│   ├── favicon.svg
│   ├── css/style.css     # Neon UI system, HUD, responsive layout, animations
│   └── js/
│       ├── main.js       # Boot, Socket.io events, join/leave flow, settings, pointer lock
│       ├── game.js       # Renderer/scene/world, local shooting, avatars, match integration
│       ├── player.js     # Input, first-person controller, remote interpolated avatars
│       ├── arena.js      # SHARED arena geometry + collision/raycast math (client & server)
│       ├── weapons.js    # Client weapon feel + procedural view-models
│       ├── world.js      # Neon arena, lighting, decor, animations
│       ├── effects.js    # GPU particles, tracers, muzzle flashes, shockwave rings
│       ├── audio.js      # Web Audio synthesizer (SFX + ambient music loop)
│       └── ui.js         # HUD/scoreboard/feed/overlay controller
├── scripts/smoke-test.mjs
├── package.json
├── Dockerfile
└── README.md
```

### Networking model

* **Movement** is client-predicted and smoothed; the server clamps every update to a legal sprint speed and resolves collisions, so wall-clipping and teleport hacks are rejected.
* **Hitscan shots** are validated and resolved **on the server** against player cylinders and arena AABBs. Clients only request a shot with an aim direction; the server decides damage, headshots, kills and respawns, then broadcasts tracers + hit events.
* **Snapshots** stream at 20 Hz; remote players are interpolated between snapshots for smooth motion. The tick loop runs at 30 Hz (health regen, bot AI, respawns, match clock).
* Rooms and scores live in memory; restarting the process clears them (no database needed).

---

## ☁️ Deploying

The app is a single Node process that serves both static files and WebSockets. Any platform that supports **WebSockets** works.

### Render

This repo ships a [`render.yaml`](render.yaml) Blueprint that deploys the game as one **free** Node web service named `neonrift`.

1. In Render: **New → Blueprint**, connect the GitHub repo, then click **Apply**.
2. Render runs `npm ci`, starts `npm start` and polls `GET /health`.
3. The game goes live at **https://neonrift.onrender.com** — a service's name becomes its `onrender.com` subdomain.

Prefer to configure it by hand? **New → Web Service → Public Git repository**, paste `https://github.com/anshumantandan1-sys/neon-rift`, then set build `npm ci`, start `npm start`, health check `/health`, plan **Free**.

Render injects `PORT` (and binds the service to `0.0.0.0`) automatically — no extra configuration.

> **Free-plan caveat:** Render spins a free service down after 15 minutes with no traffic, including WebSocket messages, and takes about a minute to wake. An active match keeps it awake; the first visitor after an idle period waits on a loading page. Rooms live in server memory, so run **exactly one instance** — no replicas or autoscaling.

### Railway

1. **New Project → Deploy from GitHub repo.**
2. Railway auto-detects Node, runs `npm install`, then `npm start`.
3. Expose the generated domain. `PORT` is provided automatically.

### Glitch

1. Import the project into Glitch (or remix).
2. Glitch runs `npm start`; the app opens in the preview pane.
3. For a stable URL, use **Share → Live app**.

### Docker / VPS

```bash
docker build -t neon-rift .
docker run -p 3000:3000 -e PORT=3000 neon-rift
```

Or on a VPS:

```bash
npm ci --omit=dev
PORT=3000 npm start
```

Put Nginx/Caddy in front for TLS; make sure WebSocket upgrade headers are forwarded (`/socket.io/`).

### Health check

```
GET /health
{ "status": "ok", "game": "NEON RIFT", "uptimeSeconds": 42, "rooms": 1, "humans": 2, "bots": 2 }
```

---

## 🧪 Testing

```bash
npm run smoke
```

The smoke suite boots the real `Room` class and verifies:

* join/leave and bot filling
* 20 Hz snapshot shape
* server hitscan hit registration + headshot multipliers
* fire-rate limiting
* kill feed, scores, deaths and respawn timers
* spawn-shield damage blocking
* line-of-fire blocking by cover
* health regeneration
* movement speed clamping and anti-teleport
* collision ejection from solid geometry
* match timer end, sorted standings, auto-restart and score reset

---

## 🔧 Customising

| Want to change… | Edit |
|---|---|
| Arena layout / cover / spawns | `public/js/arena.js` (shared by client **and** server automatically) |
| Weapon damage, fire rate, mag size, bot fill | `server/config.js` |
| Client recoil, crosshair, sound type, viewmodel | `public/js/weapons.js` |
| Bot names, match length, respawn time, spawn shield | `server/config.js` |
| Colors, fonts, HUD layout | `public/css/style.css` |
| Lighting, sky, decorations | `public/js/world.js` |
| Particles / tracers | `public/js/effects.js` |
| Synthesized sound design | `public/js/audio.js` |

Three.js is served locally from `node_modules/three/build` at `/vendor/three/three.module.js`, so the game works offline on your LAN. Google Fonts is the only optional CDN request; the UI falls back to system fonts without it.

---

## 🛠 Troubleshooting

| Symptom | Fix |
|---|---|
| **WebGL unavailable** | Enable hardware acceleration / use a current Chrome, Edge, Firefox or Safari. |
| **Port already in use** | Run with another port: `PORT=3100 npm start`. The server exits with a clear message if the port is taken. |
| **Mouse doesn't aim** | Click the arena to lock the pointer. Press Esc to pause, click **Resume** to re-lock. |
| **No sound** | Browsers require a click before audio can start — click **Quick Play** or the arena. Check the sound toggle in Settings. |
| **Weapon clips through walls** | The view-model is rendered in a separate overlay pass, so it never clips. If you see it, hard-refresh to pick up the latest JS. |
| **Friend can't join** | Both devices must reach the same server. On LAN use the host's IP (allow the port through the firewall). In the cloud, share the public URL. |
| **Choppy on a laptop** | Set **Graphics: LITE** in Settings (drops pixel ratio and shadows). |

---

## 📜 License

MIT — build on it, remix it, teach with it. Weapon names, visuals and code are original to this project.

**Have fun in the rift. ⚡**
