const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'indiamart.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    subscription_status TEXT DEFAULT 'inactive',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    keywords TEXT DEFAULT '[]',
    countries TEXT DEFAULT '[]',
    priority_keywords TEXT DEFAULT '[]',
    interval INTEGER DEFAULT 30,
    is_running INTEGER DEFAULT 0,
    cookies TEXT DEFAULT '[]',
    auto_reply_msg TEXT DEFAULT 'Thank you for your inquiry about {product}. We will get back to you shortly.',
    telegram_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    proxy_url TEXT DEFAULT '',
    min_quantity INTEGER DEFAULT 0,
    reply_enabled INTEGER DEFAULT 1,
    accept_limit INTEGER DEFAULT 600,
    current_accepted_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lead_id TEXT,
    customer_name TEXT,
    company_name TEXT,
    product TEXT,
    medicine_name TEXT DEFAULT '',
    country TEXT,
    mobile TEXT DEFAULT '',
    email TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    message TEXT DEFAULT '',
    call_details TEXT DEFAULT '',
    replied INTEGER DEFAULT 0,
    timestamp TEXT,
    status TEXT DEFAULT 'Pending',
    reason TEXT DEFAULT '',
    ai_score INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'Low',
    tags TEXT DEFAULT '[]',
    UNIQUE(user_id, lead_id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp TEXT,
    message TEXT,
    type TEXT
  );
`);

// Disable foreign keys during migration to prevent foreign key errors when rebuilding tables
db.pragma('foreign_keys = OFF');

// Safe migrations — add new columns to existing DBs first
const columnMigrations = [
  `ALTER TABLE users ADD COLUMN password TEXT DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'`,
  `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'`,
  `ALTER TABLE config ADD COLUMN auto_reply_msg TEXT DEFAULT 'Thank you for your inquiry about {product}. We will get back to you shortly.'`,
  `ALTER TABLE config ADD COLUMN telegram_token TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN telegram_chat_id TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN proxy_url TEXT DEFAULT ''`,
  `ALTER TABLE config ADD COLUMN min_quantity INTEGER DEFAULT 0`,
  `ALTER TABLE config ADD COLUMN reply_enabled INTEGER DEFAULT 1`,
  `ALTER TABLE config ADD COLUMN accept_limit INTEGER DEFAULT 600`,
  `ALTER TABLE config ADD COLUMN current_accepted_count INTEGER DEFAULT 0`,
  `ALTER TABLE config ADD COLUMN priority_keywords TEXT DEFAULT '[]'`,
  `ALTER TABLE leads ADD COLUMN quantity REAL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN mobile TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN message TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN replied INTEGER DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN ai_score INTEGER DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN priority TEXT DEFAULT 'Low'`,
  `ALTER TABLE leads ADD COLUMN tags TEXT DEFAULT '[]'`,
  `ALTER TABLE leads ADD COLUMN medicine_name TEXT DEFAULT ''`,
  `ALTER TABLE leads ADD COLUMN call_details TEXT DEFAULT ''`,
];

for (const sql of columnMigrations) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

// Seed default user: admin@leadmed.local if users table is empty
// This ensures user with ID 1 exists before we migrate data referencing it
try {
  const bcrypt = require('bcryptjs');
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    console.log('👤 Seeding default admin user: admin@leadmed.local...');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const info = db.prepare("INSERT INTO users (email, password, role, subscription_status) VALUES (?, ?, 'admin', 'active')").run(
      'admin@leadmed.local',
      hashedPassword
    );
    const userId = info.lastInsertRowid;
    
    // Seed default config for this user
    db.prepare(`
      INSERT INTO config
        (user_id, keywords, countries, priority_keywords, interval, is_running, cookies,
         auto_reply_msg, telegram_token, telegram_chat_id, proxy_url, min_quantity, reply_enabled,
         accept_limit, current_accepted_count)
      VALUES (?, '[]', '[]', '[]', 1, 0, '[]',
        'Thank you for your inquiry about {product}. We will get back to you shortly.',
        '', '', '', 0, 1, 600, 0)
    `).run(userId);
    console.log('⚙️ Default config seeded for user ID 1');
  }
} catch (e) {
  console.error('Failed to seed default user:', e.message);
}

// ── Multi-Tenancy Migrations ──────────────────────────────────────────
try {
  // Check if config table needs migration (remove CHECK (id=1))
  const configInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='config'").get();
  if (configInfo && configInfo.sql.includes('CHECK (id = 1)')) {
    console.log('⚙️ Migrating config table for multi-tenancy...');
    db.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE config RENAME TO config_old;
      CREATE TABLE config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        keywords TEXT DEFAULT '[]',
        countries TEXT DEFAULT '[]',
        priority_keywords TEXT DEFAULT '[]',
        interval INTEGER DEFAULT 30,
        is_running INTEGER DEFAULT 0,
        cookies TEXT DEFAULT '[]',
        auto_reply_msg TEXT DEFAULT 'Thank you for your inquiry about {product}. We will get back to you shortly.',
        telegram_token TEXT DEFAULT '',
        telegram_chat_id TEXT DEFAULT '',
        proxy_url TEXT DEFAULT '',
        min_quantity INTEGER DEFAULT 0,
        reply_enabled INTEGER DEFAULT 1,
        accept_limit INTEGER DEFAULT 600,
        current_accepted_count INTEGER DEFAULT 0
      );
      INSERT INTO config (id, keywords, countries, priority_keywords, interval, is_running, cookies, auto_reply_msg, telegram_token, telegram_chat_id, proxy_url, min_quantity, reply_enabled, accept_limit, current_accepted_count)
      SELECT id, keywords, countries, priority_keywords, interval, is_running, cookies, auto_reply_msg, telegram_token, telegram_chat_id, proxy_url, min_quantity, reply_enabled, accept_limit, current_accepted_count FROM config_old;
      DROP TABLE config_old;
      COMMIT;
    `);
    console.log('⚙️ Config table migration complete!');
  }
} catch (e) {
  console.error('Failed migrating config table:', e.message);
}

try {
  // Check if leads table needs migration (add user_id and composite UNIQUE constraint)
  const leadsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get();
  if (leadsInfo && (!leadsInfo.sql.includes('user_id') || !leadsInfo.sql.includes('UNIQUE(user_id'))) {
    console.log('⚙️ Migrating leads table for multi-tenancy...');
    db.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE leads RENAME TO leads_old;
      CREATE TABLE leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lead_id TEXT,
        customer_name TEXT,
        company_name TEXT,
        product TEXT,
        medicine_name TEXT DEFAULT '',
        country TEXT,
        mobile TEXT DEFAULT '',
        email TEXT DEFAULT '',
        quantity REAL DEFAULT 0,
        message TEXT DEFAULT '',
        call_details TEXT DEFAULT '',
        replied INTEGER DEFAULT 0,
        timestamp TEXT,
        status TEXT DEFAULT 'Pending',
        reason TEXT DEFAULT '',
        ai_score INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'Low',
        tags TEXT DEFAULT '[]',
        UNIQUE(user_id, lead_id)
      );
      INSERT INTO leads (id, user_id, lead_id, customer_name, company_name, product, medicine_name, country, mobile, email, quantity, message, call_details, replied, timestamp, status, reason, ai_score, priority, tags)
      SELECT id, 1, lead_id, customer_name, company_name, product, medicine_name, country, mobile, email, quantity, message, call_details, replied, timestamp, status, reason, ai_score, priority, tags FROM leads_old;
      DROP TABLE leads_old;
      COMMIT;
    `);
    console.log('⚙️ Leads table migration complete!');
  }
} catch (e) {
  console.error('Failed migrating leads table:', e.message);
}

try {
  // Ensure user_id column is added to logs table
  const logsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='logs'").get();
  if (logsInfo && !logsInfo.sql.includes('user_id')) {
    console.log('⚙️ Migrating logs table for multi-tenancy...');
    db.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE logs RENAME TO logs_old;
      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        timestamp TEXT,
        message TEXT,
        type TEXT
      );
      INSERT INTO logs (id, user_id, timestamp, message, type)
      SELECT id, 1, timestamp, message, type FROM logs_old;
      DROP TABLE logs_old;
      COMMIT;
    `);
    console.log('⚙️ Logs table migration complete!');
  }
} catch (e) {
  console.error('Failed migrating logs table:', e.message);
}

// Map any orphaned configs, leads, or logs to user_id = 1 (admin)
try {
  db.prepare("UPDATE config SET user_id = 1 WHERE user_id IS NULL").run();
  db.prepare("UPDATE leads SET user_id = 1 WHERE user_id IS NULL").run();
  db.prepare("UPDATE logs SET user_id = 1 WHERE user_id IS NULL").run();
  db.prepare("UPDATE config SET accept_limit = 600 WHERE accept_limit = 100").run();
} catch (e) {
  // Safe to fail if table schema didn't finish updating yet
}

// Re-enable foreign keys
db.pragma('foreign_keys = ON');

module.exports = db;
