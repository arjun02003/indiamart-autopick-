const express = require('express');
const cors    = require('cors');
const apiRoutes  = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();

// SSE client registry
const sseClients = new Set();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Health check ─────────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ status: 'ok', message: '🚀 IndiaMART Lead System API' }));

/* ── SSE — Real-time event stream ─────────────────────────────── */
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send heartbeat immediately
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

/* ── Routes ────────────────────────────────────────────────────── */
app.use('/api',      apiRoutes);
app.use('/api/auth', authRoutes);

/* ── Global error handler ──────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));

module.exports = app;
