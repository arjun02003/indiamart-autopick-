const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'indiamart.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    keywords TEXT DEFAULT '[]',
    countries TEXT DEFAULT '[]',
    interval INTEGER DEFAULT 30,
    is_running INTEGER DEFAULT 0,
    cookies TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT UNIQUE,
    customer_name TEXT,
    company_name TEXT,
    product TEXT,
    country TEXT,
    contact_details TEXT,
    timestamp TEXT,
    status TEXT,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    message TEXT,
    type TEXT
  );
`);

// Insert default config if not exists
const checkConfig = db.prepare('SELECT id FROM config WHERE id = 1').get();
if (!checkConfig) {
  db.prepare('INSERT INTO config (id, keywords, countries, interval, is_running, cookies) VALUES (1, ?, ?, ?, ?, ?)').run(
    '[]', '[]', 30, 0, '[]'
  );
}

module.exports = db;
