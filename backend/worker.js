const db                       = require('./db');
const { fetchLeads, sendMessage } = require('./services/indiamartService');
const { sendTelegramNotification } = require('./services/telegramService');

let workerTimer    = null;
let broadcastFn    = null;   // injected from server after boot
let sessionExpired = false;
let isProcessing   = false;  // Lock to prevent concurrent cycles

/* ── Logging ───────────────────────────────────────────────────── */
function log(type, message) {
  db.prepare('INSERT INTO logs (timestamp, message, type) VALUES (?, ?, ?)').run(
    new Date().toISOString(), message, type
  );
  console.log(`[${type}] ${message}`);
  if (broadcastFn) broadcastFn('log', { type, message, timestamp: new Date().toISOString() });
}

/* ── Random human-like delay (3–12 s) ─────────────────────────── */
function randomDelay(minMs = 3000, maxMs = 12000) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs));
}

/* ── Country alias normalisation ──────────────────────────────── */
const COUNTRY_ALIASES = {
  'united states': 'usa', 'united states of america': 'usa', 'us': 'usa',
  'united kingdom': 'uk', 'great britain': 'uk', 'england': 'uk',
  'united arab emirates': 'uae',
};
function normaliseCountry(c) {
  const l = c.toLowerCase();
  return COUNTRY_ALIASES[l] || l;
}

/* ── Skip-condition checks ─────────────────────────────────────── */
function isSpam(lead) {
  const spamKeywords = ['test', 'testing', 'demo', 'xxxxx', '12345'];
  const text = `${lead.product} ${lead.message}`.toLowerCase();
  return spamKeywords.some(kw => text === kw);
}

function isEmpty(lead) {
  return !lead.product && !lead.message;
}

/* ── Interpolate reply message ─────────────────────────────────── */
function buildReplyMessage(template, lead) {
  return template
    .replace(/\{name\}/gi,    lead.customer_name || 'Valued Customer')
    .replace(/\{product\}/gi, lead.product || 'your product')
    .replace(/\{company\}/gi, lead.company_name || 'your company')
    .replace(/\{country\}/gi, lead.country || '');
}

/* ── Main fetch + process cycle ────────────────────────────────── */
async function runCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
    if (!config || config.is_running === 0) {
      isProcessing = false;
      return;
    }

    if (config.current_accepted_count >= config.accept_limit) {
      log('INFO', `🚫 Limit hit (${config.current_accepted_count}/${config.accept_limit}). Stopping.`);
      db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();
      if (broadcastFn) broadcastFn('status_update', { isRunning: false });
      stopWorker();
      isProcessing = false;
      return;
    }

  const keywords   = JSON.parse(config.keywords  || '[]').map(k => k.toLowerCase());
  const countries  = JSON.parse(config.countries || '[]').map(c => c.toLowerCase());
  const minQty     = config.min_quantity || 0;
  const proxyUrl   = config.proxy_url    || '';
  const replyEnabled = config.reply_enabled === 1;
  const replyMsg   = config.auto_reply_msg || 'Thank you for your inquiry.';
  const tgToken    = config.telegram_token    || '';
  const tgChatId   = config.telegram_chat_id  || '';
  const acceptLimit = config.accept_limit || 100;
  const currentCount = config.current_accepted_count || 0;

  if (currentCount >= acceptLimit) {
    log('INFO', `🚫 Accept limit reached (${currentCount}/${acceptLimit}). Stopping auto mode.`);
    db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();
    if (broadcastFn) broadcastFn('status_update', { isRunning: false });
    stopWorker();
    return;
  }

  log('FETCH', '🔄 Starting lead fetch cycle…');
  log('INFO', `Config — keywords:${keywords.length} countries:${countries.length} minQty:${minQty} replyEnabled:${replyEnabled}`);

  let leads;
  try {
    leads = await fetchLeads(config.cookies, proxyUrl);
  } catch (err) {
    if (err.code === 'SESSION_EXPIRED') {
      sessionExpired = true;
      db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();
      log('ERROR', '⚠️ Session expired — auto mode stopped. Please re-upload cookies.');
      if (broadcastFn) broadcastFn('session_expired', {});
      stopWorker();
      return;
    }
    log('ERROR', `❌ Fetch failed: ${err.message}`);
    if (broadcastFn) broadcastFn('cycle_done', { accepted: 0, skipped: 0, total: 0, error: err.message });
    return;
  }

  log('INFO', `📥 Fetched ${leads.length} leads from IndiaMART`);
  if (leads.length > 0) {
    log('INFO', `🆕 Most recent lead found: ${leads[0].customer_name}`);
  }
  
  // ── SORT BY TIMESTAMP (Newest first)
  leads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (leads.length === 0) {
    log('INFO', 'No leads in response (check cookies/session or no new leads available)');
  }

  let accepted = 0, skipped = 0;

  for (const lead of leads) {
    // Brief human-like delay between each lead
    await randomDelay(300, 1200);

    // ── Duplicate check
    const existing = db.prepare('SELECT id, replied FROM leads WHERE lead_id = ?').get(lead.lead_id);
    if (existing) {
      if (!existing.replied) {
        // Already in DB but not replied — try again
      } else {
        continue; // fully done
      }
    }

    // ── Skip conditions
    if (isEmpty(lead)) {
      db.prepare(`INSERT OR IGNORE INTO leads (lead_id,customer_name,company_name,product,country,mobile,email,quantity,message,timestamp,status,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(lead.lead_id, lead.customer_name, lead.company_name, lead.product, lead.country, lead.mobile, lead.email, lead.quantity, lead.message, new Date().toISOString(), 'Skipped', 'Empty inquiry');
      skipped++; continue;
    }
    if (isSpam(lead)) {
      db.prepare(`INSERT OR IGNORE INTO leads (lead_id,customer_name,company_name,product,country,mobile,email,quantity,message,timestamp,status,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(lead.lead_id, lead.customer_name, lead.company_name, lead.product, lead.country, lead.mobile, lead.email, lead.quantity, lead.message, new Date().toISOString(), 'Skipped', 'Spam detected');
      skipped++; continue;
    }

    // ── Keyword filter
    let keywordMatch = keywords.length === 0;
    if (!keywordMatch) {
      const text = `${lead.product} ${lead.message}`.toLowerCase();
      keywordMatch = keywords.some(kw => text.includes(kw));
    }

    // ── Country filter
    let countryMatch = countries.length === 0;
    if (!countryMatch) {
      const nc = normaliseCountry(lead.country);
      countryMatch = countries.some(c => nc.includes(c) || lead.country.toLowerCase().includes(c));
    }

    // ── Quantity filter
    const qtyMatch = minQty === 0 || lead.quantity >= minQty;

    const isAccepted = keywordMatch && countryMatch && qtyMatch;

    let reason = 'Matched';
    if (!isAccepted) {
      const reasons = [];
      if (!keywordMatch) reasons.push('Keyword mismatch');
      if (!countryMatch) reasons.push('Country mismatch');
      if (!qtyMatch)     reasons.push(`Qty ${lead.quantity} < ${minQty}`);
      reason = reasons.join('; ');
    }

    const status = isAccepted ? 'Accepted' : 'Skipped';

    // Insert/update lead in DB
    db.prepare(`
      INSERT INTO leads (lead_id,customer_name,company_name,product,country,mobile,email,quantity,message,timestamp,status,reason,replied)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(lead_id) DO UPDATE SET status=excluded.status, reason=excluded.reason
    `).run(
      lead.lead_id, lead.customer_name, lead.company_name, lead.product,
      lead.country, lead.mobile, lead.email, lead.quantity, lead.message,
      new Date().toISOString(), status, reason
    );

    if (isAccepted) {
      accepted++;
      db.prepare('UPDATE config SET current_accepted_count = current_accepted_count + 1 WHERE id = 1').run();
      
      log('ACCEPT', `✅ Accepted: ${lead.customer_name} | ${lead.product} | ${lead.country}`);
      
      // Check limit again after incrementing
      const check = db.prepare('SELECT current_accepted_count, accept_limit FROM config WHERE id = 1').get();
      if (check.current_accepted_count >= check.accept_limit) {
        log('INFO', `🚫 Accept limit reached (${check.current_accepted_count}/${check.accept_limit}). Stopping immediately.`);
        db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();
        if (broadcastFn) broadcastFn('status_update', { isRunning: false });
        stopWorker();
        break; 
      }

      // ── Auto reply
      if (replyEnabled) {
        await randomDelay(2000, 5000); // human-like delay before reply
        try {
          const msg = buildReplyMessage(replyMsg, lead);
          await sendMessage(config.cookies, lead.lead_id, msg, proxyUrl);
          db.prepare('UPDATE leads SET replied = 1 WHERE lead_id = ?').run(lead.lead_id);
          log('REPLY', `💬 Replied to lead ${lead.lead_id}`);
        } catch (e) {
          log('ERROR', `Reply failed for ${lead.lead_id}: ${e.message}`);
        }
      }

      // ── Telegram notification
      if (tgToken && tgChatId) {
        await sendTelegramNotification(
          tgToken, tgChatId,
          `🎯 <b>New Lead Accepted!</b>\n👤 ${lead.customer_name}\n🏢 ${lead.company_name}\n📦 ${lead.product}\n🌍 ${lead.country}\n📞 ${lead.mobile || 'N/A'}`
        );
      }

      // Broadcast to SSE clients
      if (broadcastFn) broadcastFn('lead_accepted', lead);
    } else {
      skipped++;
      log('SKIP', `⏭️ Skipped: ${lead.customer_name} | ${reason}`);
    }
  }

  log('INFO', `✔️ Cycle done — Accepted: ${accepted}, Skipped: ${skipped}`);
  if (broadcastFn) broadcastFn('cycle_done', { accepted, skipped, total: leads.length });
    isProcessing = false;
  } catch (err) {
    log('ERROR', `Critical worker error: ${err.message}`);
    isProcessing = false;
  }

  // Update DB stats cache
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='Accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='Skipped'  THEN 1 ELSE 0 END) as skipped,
      SUM(replied) as replied
    FROM leads
  `).get();
  if (broadcastFn) broadcastFn('stats', stats);
}

/* ── Worker control ────────────────────────────────────────────── */
function startWorker(broadcast) {
  if (workerTimer) return;
  if (broadcast) broadcastFn = broadcast;

  sessionExpired = false;
  const config    = db.prepare('SELECT interval FROM config WHERE id = 1').get();
  const intervalMs = Math.max(10, config?.interval || 30) * 1000;

  log('INFO', `🚀 Auto mode started — interval ${intervalMs / 1000}s`);
  runCycle(); // immediate first run
  workerTimer = setInterval(runCycle, intervalMs);
}

function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    log('INFO', '⛔ Auto mode stopped');
  }
}

function isWorkerRunning() { return workerTimer !== null; }
function isSessionExpiredState() { return sessionExpired; }
function setBroadcast(fn) { broadcastFn = fn; }

module.exports = { startWorker, stopWorker, isWorkerRunning, isSessionExpiredState, setBroadcast };
