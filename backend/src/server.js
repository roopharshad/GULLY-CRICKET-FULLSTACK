/**
 * server.js — GullyCricket Backend
 *
 * Features:
 *  • Express REST API for all data (players, teams, matches, users, admin)
 *  • WebSocket server for real-time live updates to browser clients
 *  • Supabase Realtime listener → broadcasts to WebSocket clients
 *  • Helmet, CORS, rate-limiting for production hardening
 */

'use strict';
require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');

const supabase  = require('./config/supabase');
const broadcast = require('./services/broadcast');

const appDataRouter = require('./routes/appData');
const playersRouter = require('./routes/players');
const teamsRouter   = require('./routes/teams');
const matchesRouter = require('./routes/matches');
const usersRouter   = require('./routes/users');
const adminRouter   = require('./routes/admin');

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Token'],
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

// Global rate limit — 200 req / minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/data',    appDataRouter);
app.use('/api/players', playersRouter);
app.use('/api/teams',   teamsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/users',   usersRouter);
app.use('/api/admin',   adminRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── HTTP + WebSocket Server ───────────────────────────────────────────────────
const PORT   = parseInt(process.env.PORT || '3000', 10);
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

broadcast.init(wss);

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] client connected — ${ip} (total: ${wss.clients.size})`);

  // Send a welcome ping with current server time
  ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    console.log(`[WS] client disconnected — ${ip} (total: ${wss.clients.size})`);
  });

  ws.on('error', err => console.error('[WS] error:', err.message));
});

// ── Supabase Realtime → WebSocket bridge ─────────────────────────────────────
// Listen to Supabase changes server-side and push to all WS clients.
// This means browsers don't need the Supabase key at all for live updates.
function startRealtimeBridge() {
  const channel = supabase.channel('server-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' },
      payload => broadcast.broadcast('data_updated',    { table: 'app_data',  payload }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' },
      payload => broadcast.broadcast('players_updated', { table: 'players',   payload }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },
      payload => broadcast.broadcast('teams_updated',   { table: 'teams',     payload }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' },
      payload => broadcast.broadcast('matches_updated', { table: 'matches',   payload }))
    .subscribe(status => {
      console.log(`[Realtime] status: ${status}`);
    });

  return channel;
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🏏  GullyCricket backend running on port ${PORT}`);
  console.log(`    REST API  → http://localhost:${PORT}/api`);
  console.log(`    WebSocket → ws://localhost:${PORT}/ws`);
  console.log(`    Health    → http://localhost:${PORT}/health\n`);
  startRealtimeBridge();
});

module.exports = { app, server };
