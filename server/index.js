import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { GameServer } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THREE_BUILD = path.join(ROOT, 'node_modules', 'three', 'build');

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// Three.js is served locally so the game works fully offline during development.
app.use(
  '/vendor/three',
  express.static(THREE_BUILD, {
    immutable: true,
    maxAge: '7d',
    fallthrough: false,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 10000,
  pingTimeout: 9000,
  serveClient: true,
});

const game = new GameServer(io);
game.start();

app.get('/health', (req, res) => {
  const rooms = [...game.rooms.values()];
  res.json({
    status: 'ok',
    game: 'NEON RIFT',
    uptimeSeconds: Math.round(process.uptime()),
    rooms: rooms.length,
    humans: rooms.reduce((n, r) => n + r.humanCount(), 0),
    bots: rooms.reduce((n, r) => n + [...r.players.values()].filter((p) => p.isBot).length, 0),
  });
});

app.get(/^\/(?!socket\.io|health|vendor).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[neon-rift] Port ${PORT} is already in use. Set PORT to a free port.`);
  } else {
    console.error('[neon-rift] HTTP server error:', err);
  }
  game.stop();
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ███ NEON RIFT — MULTIPLAYER ARENA ONLINE ███');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log('');
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[neon-rift] ${signal} received — shutting down.`);
  game.stop();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[neon-rift] uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[neon-rift] unhandled rejection:', err);
});
