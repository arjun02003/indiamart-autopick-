require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const apiRoutes  = require('./routes/api');
const authRoutes = require('./routes/auth');
const path = require('path');
const db = require('./db');
const worker = require('./worker');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SESSION_SECRET || 'super-secret-jwt-key-9988';

// ── Global crash protection — keep server alive on unhandled errors ──
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled Promise Rejection (server kept alive):', reason?.message || reason);
});

const app = express();

// SSE client registry: userId -> Set(res)
const sseClients = new Map();

// CORS
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — relaxed for local dev, stricter in production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    const ip = req.ip || '';
    // Skip for SSE stream and localhost
    return req.path === '/api/events' || ip === '127.0.0.1' || ip === '::1' || ip.includes('::ffff:127');
  },
});
app.use('/api', limiter);

/* ── Serve public helper tools ─────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

/* ── Routes ────────────────────────────────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api',      apiRoutes);

/* ── Health check ─────────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ status: 'ok', message: '🚀 IndiaMART Lead System API', version: '2.0.0' }));

/* ── SSE — Real-time event stream ─────────────────────────────── */
app.get('/api/events', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  let userId;
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    userId = verified.id;
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write('event: ping\ndata: connected\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write('event: ping\ndata: heartbeat\n\n');
  }, 25000);

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
});

/* ── Broadcast helper (used by worker) ────────────────────────── */
function broadcast(userId, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const clients = sseClients.get(userId);
  if (clients) {
    for (const client of clients) {
      if (!client.writableEnded) client.write(payload);
    }
  }
}

// Attach broadcast to app so routes/worker can access it
app.locals.broadcast = broadcast;

/* ── Global error handler ──────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.use((req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);

  // Always reset is_running on startup for all configs
  try {
    db.prepare('UPDATE config SET is_running = 0').run();
    console.log('🔄 Reset auto mode state for all tenants.');
  } catch (err) {
    console.error('Failed to reset config running states on startup:', err.message);
  }
});

module.exports = app;
