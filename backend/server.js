const express = require('express');
const cors = require('cors');
const db = require('./db');
const { startWorker, stopWorker, isWorkerRunning } = require('./worker');

const app = express();
app.use(cors());
app.use(express.json());

// Get configuration
app.get('/api/config', (req, res) => {
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  res.json({
    ...config,
    keywords: JSON.parse(config.keywords),
    countries: JSON.parse(config.countries),
    cookies: JSON.parse(config.cookies),
    is_running: config.is_running === 1
  });
});

// Update configuration
app.post('/api/config', (req, res) => {
  const { keywords, countries, interval, cookies } = req.body;
  const current = db.prepare('SELECT * FROM config WHERE id = 1').get();
  
  db.prepare(`
    UPDATE config 
    SET keywords = ?, countries = ?, interval = ?, cookies = ?
    WHERE id = 1
  `).run(
    JSON.stringify(keywords !== undefined ? keywords : JSON.parse(current.keywords)),
    JSON.stringify(countries !== undefined ? countries : JSON.parse(current.countries)),
    interval !== undefined ? interval : current.interval,
    JSON.stringify(cookies !== undefined ? cookies : JSON.parse(current.cookies))
  );
  
  res.json({ success: true });
});

// Toggle start/stop
app.post('/api/toggle', (req, res) => {
  const { is_running } = req.body;
  db.prepare('UPDATE config SET is_running = ? WHERE id = 1').run(is_running ? 1 : 0);
  
  if (is_running) {
    startWorker();
  } else {
    stopWorker();
  }
  
  res.json({ success: true, is_running });
});

// Get Dashboard Stats
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const accepted = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = "Accepted"').get().count;
  const failed = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = "Failed"').get().count;
  
  // Get last check time from logs
  const lastCheck = db.prepare('SELECT timestamp FROM logs WHERE type = "FETCH" ORDER BY id DESC LIMIT 1').get();
  
  res.json({
    total,
    accepted,
    failed,
    lastCheckTime: lastCheck ? lastCheck.timestamp : null
  });
});

// Get Leads (Activity Log)
app.get('/api/leads', (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 100').all();
  res.json(leads);
});

// Sync worker state on boot
const currentConfig = db.prepare('SELECT is_running FROM config WHERE id = 1').get();
if (currentConfig.is_running === 1) {
  startWorker();
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
