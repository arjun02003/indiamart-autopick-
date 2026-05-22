const db = require('./db');

const logs = db.prepare('SELECT id, timestamp, type, message FROM logs ORDER BY id DESC LIMIT 15').all();
console.log('Last 15 Logs:');
logs.forEach(l => {
  console.log(`[${l.timestamp}] [${l.type}] ${l.message}`);
});
