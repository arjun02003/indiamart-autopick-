const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const worker = require('./worker');

const app = express();
const PORT = process.env.PORT || 3001;

// ===========================
// MIDDLEWARE
// ===========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===========================
// APP LOCALS (for worker broadcast)
// ===========================
const clientsSet = new Set();

function broadcast(type, data) {
  const message = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const res of clientsSet) {
    res.write(message);
  }
}

app.locals.broadcast = broadcast;

// ===========================
// ROUTES
// ===========================
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);

// ===========================
// SSE ENDPOINT (Server-Sent Events)
// ===========================
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clientsSet.add(res);

  res.write(':\n\n'); // Keep-alive comment

  req.on('close', () => {
    clientsSet.delete(res);
    res.end();
  });
});

// ===========================
// HEALTH CHECK
// ===========================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================
// ERROR HANDLING
// ===========================
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ===========================
// START SERVER
// ===========================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   IndiaMART Auto Lead System Backend   ║
║          🚀 Server Started             ║
║      http://localhost:${PORT}          ║
╚════════════════════════════════════════╝
  `);

  // Ensure config table has at least one row
  try {
    const config = db.prepare('SELECT COUNT(*) as cnt FROM config').get();
    if (config.cnt === 0) {
      db.prepare(`
        INSERT INTO config (
          id, keywords, countries, interval, is_running, 
          cookies, auto_reply_msg, telegram_token, telegram_chat_id,
          proxy_url, min_quantity, reply_enabled, accept_limit, current_accepted_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        1, '[]', '[]', 30, 0,
        '[]',
        'Thank you for your inquiry about {product}. We will get back to you shortly.',
        '', '', '', 0, 1, 100, 0
      );
      console.log('✓ Default config created');
    }
  } catch (e) {
    console.error('Config init error:', e.message);
  }
});

// ===========================
// GRACEFUL SHUTDOWN
// ===========================
process.on('SIGINT', () => {
  console.log('\n\n╔════════════════════════════════════════╗');
  console.log('║        🛑 Server Shutting Down        ║');
  console.log('╚════════════════════════════════════════╝\n');
  worker.stopWorker();
  process.exit(0);
});
