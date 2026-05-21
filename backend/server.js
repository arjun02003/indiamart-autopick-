require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const apiRoutes  = require('./routes/api');
const authRoutes = require('./routes/auth');
const path = require('path');
const db = require('./db');
const worker = require('./worker');

const app = express();

// SSE client registry
const sseClients = new Set();

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
app.use('/api',      apiRoutes);
app.use('/api/auth', authRoutes);

/* ── Health check ─────────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ status: 'ok', message: '🚀 IndiaMART Lead System API', version: '2.0.0' }));

/* ── SSE — Real-time event stream ─────────────────────────────── */
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write('event: ping\ndata: connected\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write('event: ping\ndata: heartbeat\n\n');
  }, 25000);

  sseClients.add(res);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

/* ── Broadcast helper (used by worker) ────────────────────────── */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    if (!client.writableEnded) client.write(payload);
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

  // Always reset is_running on startup — prevents stale session errors
  db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();

  // Only auto-start worker if valid cookies are present
  const config = db.prepare('SELECT cookies FROM config WHERE id = 1').get();
  const hasCookies = config && config.cookies && config.cookies.length > 10 && config.cookies !== '[]';

  if (hasCookies) {
    console.log('🍪 Cookies found — Auto Mode ready. Click Start to begin.');
  } else {
    console.log('ℹ️ No cookies saved yet. Go to Settings → upload your IndiaMART cookies.');
  }
});

module.exports = app;
