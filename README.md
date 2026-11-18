# ⚡ NEON RIFT — Countryside Robot Battleground

**A fast, vibrant, real-time multiplayer 3D shooter that runs in the browser.**

NEON RIFT has moved out of the neon arena and into the countryside. Five weapons, five lives and a pasture full of humanoid combat robots, winding dirt roads, farm cover and huntable wildlife — no installs, no downloads, just click and play.

> **Tech:** Three.js (WebGL) on the client · Node.js + Express + Socket.io on the server · fully server-authoritative hitscan, lives and wildlife.

---

## ✨ Features

| | |
|---|---|
| **Instant multiplayer** | Quick Play auto-matchmaking or join with a room code (`NR-XXXX`). Up to 8 humans per room. |
| **Bots keep it lively** | Human-like robot bots fill empty slots (up to 4 fighters total per room) and step aside as real players join. |
| **Five weapons** | Vanguard Pistol, Ranch Sweeper shotgun, Ranger rifle, Hornet SMG and Longshot DMR — each with its own procedural first-person model, recoil, crosshair and sound. |
| **Five lives per match** | Every wreck costs one chassis. Lose all five and you are eliminated; the match ends early when only one fighter still has lives. |
| **First-person body** | Gloved hands, sleeves, torso and a physical weapon are visible in a separate overlay pass, so the gun never clips through cover. |
| **Countryside battlefield** | 70 × 70 m fenced pasture with a winding pebbled road, grass, rolling hills, oaks, a barn, silo, windmill, stone ruin, pond, hay bales, crates, stone walls and fences. |
| **Huntable animals** | Deer, bears and chickens wander the pasture. Shoot them to heal and raise your **hunts** score; they respawn after 22 s. |
| **Made to survive** | 3-second spawn shields, forgiving health regen, softened bot aim and a **Ctrl/C combat dodge** with 460 ms of invulnerability. A directional indicator points at whoever is shooting you. |
| **Robots that fall** | Every opponent is a humanoid combat robot with a name tag, health bar and a proper topple-over wreck animation. |
| **Juicy feedback** | Recoil kick, muzzle flashes, tracers, impact sparks, kill bursts, screen shake, FOV punch, dynamic crosshairs, hitmarkers and damage numbers. |
| **100% synthesized audio** | Every shot, hit, dodge, heal, footstep, reload and UI blip is generated with the Web Audio API — zero audio assets. |
| **Live match HUD** | Health, hearts, hunts, dodge meter, ammo, five weapon slots, kills/deaths, streak, match clock, room code, kill feed, notices and a Tab scoreboard with LIVES/HUNTS columns. |
| **Server-authoritative** | The server simulates hitscan bullets, validates fire rate, clamps movement, resolves collisions and owns health, lives, eliminations, kills, hunts and wildlife. |
| **Cloud-ready** | `process.env.PORT` binding, `/health` endpoint, graceful shutdown, Dockerfile, no database required. |

---

## 🚀 Quick start (local development)

**Requirements:** Node.js **18+** and a desktop browser with WebGL (Chrome, Edge, Firefox, Safari).

```bash
npm install
npm start
```

Open **http://localhost:3000**.

To play with a friend on the same Wi-Fi network, open `http://<your-lan-ip>:3000` on the second device and use the same room code (or just Quick Play — you'll land in the same room if it has space). The server prints its local address on startup.

### Useful scripts

| Command | What it does |
|---|---|
| `npm start` | Production-style start (`node server/index.js`). |
| `npm run dev` | Auto-restart the server on file changes (`node --watch`). |
| `npm run smoke` | Runs 67 deterministic server-logic checks (lives, elimination, wildlife, dodge i-frames, hitscan, respawns, bots, match lifecycle). |
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
| **1 – 5** | Pistol / Shotgun / Rifle / SMG / DMR |
| **Mouse wheel** / **Q** | Cycle weapons |
| **Ctrl** or **C** | Combat dodge (brief invulnerability burst) |
| **R** | Reload |
| **Shift** | Sprint |
| **Space** | Jump |
| **Tab** (hold) | Live scoreboard |
| **Esc** | Pause / release cursor |
| **Click arena** | Lock the mouse cursor |

### Weapons

| Slot | Weapon | Damage | Fire rate | Magazine | Notes |
|---|---|---|---|---|---|
| 1 | **Vanguard Pistol** | 23 | 145 ms | 14 | Precise semi-auto, low recoil. Headshots ×2. |
| 2 | **Ranch Sweeper** | 11 × 9 pellets | 860 ms | 6 | Devastating up close, wide crosshair. Headshots ×1.6. |
| 3 | **Ranger Rifle** | 13 | 105 ms | 32 | Full-auto all-rounder. Headshots ×2. |
| 4 | **Hornet SMG** | 9 | 78 ms | 40 | Fast, jumpy and forgiving. Headshots ×1.8. |
| 5 | **Longshot DMR** | 36 | 430 ms | 8 | Hard-hitting marksman rifle. Headshots ×2.3. |

### Lives, survival and wildlife

* Everyone starts with **5 lives**. A wreck costs one life and rebuilds you after 3.4 s with a 3-second spawn shield.
* Lose all five and you are **eliminated**: your chassis stays on the field and you spectate the ranch until the round ends.
* If only one fighter still has lives, the match ends early as a **last-standing** victory; otherwise the highest kills win when the **5-minute** timer expires.
* **Combat dodge** gives 460 ms of invulnerability on a 2.6 s cooldown — use it to break a bot's firing line.
* Health regenerates at 16 HP/s after 4.6 s out of combat. Bots deliberately aim with human-like spread and deal 62% damage.
* Shooting a **deer** (+25 HP), **bear** (+35 HP) or **chicken** (+10 HP) heals you and adds to your hunt count. Animals respawn after 22 s.

### Rooms

* **Quick Play** finds the busiest open room or creates a fresh one.
* Enter a **room code** to join a specific room. Codes are 2–10 letters/numbers.
* Click the room chip in the HUD to copy the code and share it.
* Bots are added/removed automatically so the room always has about four fighters until humans fill it.

---

## 🗂 Project structure

```
.
├── server/
│   ├── index.js          # Express + Socket.io bootstrap, static hosting, /health, graceful shutdown
│   ├── rooms.js          # Room manager, game loop, lives, wildlife, hitscan, bots, match lifecycle
│   └── config.js         # Server tuning: weapons, lives, dodge, animals, match duration, bot fill
├── public/
│   ├── index.html        # Menus, loadout picker, HUD, overlays (all screens)
│   ├── favicon.svg
│   ├── css/style.css     # Neon-countryside UI system, HUD, responsive layout, animations
│   └── js/
│       ├── main.js       # Boot, Socket.io events, join/leave flow, loadout persistence, settings
│       ├── game.js       # Renderer/scene, local shooting, lives, dodge, animals, match integration
│       ├── player.js     # Input, first-person controller, humanoid robot avatars + topple deaths
│       ├── animals.js    # Procedural deer/bear/chicken models, walk/gaze/fall animation, tags
│       ├── arena.js      # SHARED geometry + collision/raycast math (client & server)
│       ├── weapons.js    # Client weapon feel + five procedural view-models and gloved arms
│       ├── world.js      # Procedural countryside: road, barn, silo, windmill, pond, trees, sky
│       ├── effects.js    # GPU particles, tracers, muzzle flashes, shockwave rings
│       ├── audio.js      # Web Audio synthesizer (SFX + ambient music loop)
│       └── ui.js         # HUD/hearts/hunts/dodge/loadout/scoreboard/overlay controller
├── scripts/smoke-test.mjs
├── package.json
├── Dockerfile
├── render.yaml
└── README.md
```

### Networking model

* **Movement** is client-predicted and smoothed; the server clamps every update to a legal sprint/dodge speed and resolves collisions, so wall-clipping and teleport hacks are rejected.
* **Hitscan shots** are validated and resolved **on the server** against player cylinders, animal capsules and arena AABBs. Clients only request a shot with an aim direction and weapon id; the server decides damage, headshots, kills, lives, eliminations and hunts, then broadcasts tracers, hits and animal events.
* **Dodge** is requested by the client movement direction and owned by the server: the server records the i-frame window and rejects incoming damage during it, then broadcasts the roll to nearby players.
* **Wildlife** is simulated on the server (wander, obstacle avoidance, health, respawn) and streamed in snapshots; the client only animates the models.
* **Snapshots** stream at 20 Hz; remote players and animals are interpolated between snapshots for smooth motion. The tick loop runs at 30 Hz (health regen, bot AI, respawns, dodge timers, wildlife, match clock).
* Rooms, scores and wildlife live in memory; restarting the process clears them (no database needed).

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

* join/leave, loadouts and bot filling
* 5 starting lives per fighter
* 20 Hz snapshot shape (lives, hunts, dodge state, animals)
* server hitscan hit registration + headshot multipliers
* fire-rate limiting and weapon validation
* kill feed, scores, deaths, one-life-per-wreck and respawn timers
* spawn-shield damage blocking
* **dodge i-frames and cooldown**
* **wildlife damage, kills, healing, hunts and respawn**
* **five-life elimination, death payload and last-standing early finish**
* line-of-fire blocking by cover
* health regeneration
* movement speed clamping and anti-teleport
* collision ejection from solid geometry
* match timer end, sorted standings, auto-restart, score/lives/hunts reset

A headless Chrome pass (Playwright) additionally verifies the menu, five loadout cards, five weapon slots, live hearts/hunts HUD, weapon switching, viewmodel visibility, dodge trigger, firing and the Tab scoreboard.

---

## 🔧 Customising

| Want to change… | Edit |
|---|---|
| Arena layout / cover / spawns / animal spawns | `public/js/arena.js` (shared by client **and** server automatically) |
| Weapon damage, fire rate, mag size, lives, dodge, animals, bot fill | `server/config.js` |
| Client recoil, crosshair, sound type, viewmodel | `public/js/weapons.js` |
| Bot names, match length, respawn time, spawn shield | `server/config.js` |
| Animal models, tags, animation | `public/js/animals.js` |
| Colors, fonts, HUD layout | `public/css/style.css` |
| Lighting, sky, countryside decorations, road | `public/js/world.js` |
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
| **Dodge won't fire** | Dodge needs a short cooldown (2.6 s) and must be used while grounded. Watch the CTRL meter in the bottom-left. |

---

## 📜 License

MIT — build on it, remix it, teach with it. Weapon names, visuals and code are original to this project.

**See you on the ranch. ⚡**
