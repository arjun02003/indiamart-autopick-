const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'indiamart.db');
const db = new Database(dbPath);
try {
  const info = db.prepare('DELETE FROM leads').run();
  console.log('Deleted leads, rows affected:', info.changes);
  db.prepare('VACUUM').run();
  console.log('VACUUM completed');
} catch (err) {
  console.error('Error clearing leads:', err);
}
process.exit();
