const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'indiamart.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    keywords TEXT DEFAULT '[]',
    countries TEXT DEFAULT '[]',
    interval INTEGER DEFAULT 30,
    is_running INTEGER DEFAULT 0,
    cookies TEXT DEFAULT '[]',
    auto_reply_msg TEXT DEFAULT 'Thank you for your inquiry about {product}. We will get back to you shortly.',
    telegram_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    proxy_url TEXT DEFAULT '',
    min_quantity INTEGER DEFAULT 0,
    reply_enabled INTEGER DEFAULT 1,
    accept_limit INTEGER DEFAULT 100,
    current_accepted_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT UNIQUE,
    customer_name TEXT,
    company_name TEXT,
    product TEXT,
    country TEXT,
    mobile TEXT DEFAULT '',
    email TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    message TEXT DEFAULT '',
    replied INTEGER DEFAULT 0,
    timestamp TEXT,
    status TEXT DEFAULT 'Pending',
    reason TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    message TEXT,
    type TEXT
  );
`);

// Safe migrations — add new columns to existing DBs
const migrations = [
  `ALTER TABLE config ADD COLUMN auto_reply_msg TEXT DEFAULT 'Thank you for your inquiry about {product}. We will get back to you shortly.'`,
  `ALTER TABLE config ADD COLUMN telegram_token TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN telegram_chat_id TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN proxy_url TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN min_quantity INTEGER DEFAULT 0`,
  `ALTER TABLE config ADD COLUMN reply_enabled INTEGER DEFAULT 1`,
  `ALTER TABLE leads ADD COLUMN quantity REAL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN mobile TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN message TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN replied INTEGER DEFAULT 0`,
  `ALTER TABLE config ADD COLUMN accept_limit INTEGER DEFAULT 100`,
  `ALTER TABLE config ADD COLUMN current_accepted_count INTEGER DEFAULT 0`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

// Seed default config row
const existing = db.prepare('SELECT id FROM config WHERE id = 1').get();
if (!existing) {
  db.prepare(`
    INSERT INTO config
      (id, keywords, countries, interval, is_running, cookies,
       auto_reply_msg, telegram_token, telegram_chat_id, proxy_url, min_quantity, reply_enabled,
       accept_limit, current_accepted_count)
    VALUES (1, '[]', '[]', 1, 0, '[]',
      'Thank you for your inquiry about {product}. We will get back to you shortly.',
      '', '', '', 0, 1, 100, 0)
  `).run();
}

module.exports = db;
