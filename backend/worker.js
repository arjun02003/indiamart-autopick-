const db                       = require('./db');
const { fetchRecentLeads, sendMessage } = require('./services/indiamartService');
const { sendTelegramNotification } = require('./services/telegramService');
const { scoreLead, extractMedicineNames, extractTags, isHighPriority } = require('./services/aiScoringService');

const activeTimers       = new Map(); // userId -> setInterval object
const processingUsers    = new Set(); // userId
const sessionExpiredUsers = new Set(); // userId
let broadcastFn          = null;

/* ── Logging ───────────────────────────────────────────────────── */
function log(userId, type, message) {
  try {
    db.prepare('INSERT INTO logs (user_id, timestamp, message, type) VALUES (?, ?, ?, ?)').run(
      userId, new Date().toISOString(), message, type
    );
  } catch (err) {
    console.error(`[Worker Log Error] Failed to write log to database: ${err.message}`);
  }
  console.log(`[User ${userId}] [${type}] ${message}`);
  if (broadcastFn) {
    broadcastFn(userId, 'log', { type, message, timestamp: new Date().toISOString() });
  }
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

// Check for empty lead
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
async function runCycle(userId) {
  if (processingUsers.has(userId)) return;
  processingUsers.add(userId);

  try {
    const config = db.prepare('SELECT * FROM config WHERE user_id = ?').get(userId);
    if (!config || config.is_running === 0) {
      processingUsers.delete(userId);
      return;
    }

    // Verify subscription status
    const user = db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(userId);
    if (!user || user.subscription_status !== 'active') {
      log(userId, 'INFO', '🚫 Premium Subscription required to run Auto Mode. Stopping worker.');
      db.prepare('UPDATE config SET is_running = 0 WHERE user_id = ?').run(userId);
      if (broadcastFn) broadcastFn(userId, 'status_update', { isRunning: false });
      stopWorker(userId);
      processingUsers.delete(userId);
      return;
    }

    if (config.current_accepted_count >= config.accept_limit) {
      log(userId, 'INFO', `🚫 Limit hit (${config.current_accepted_count}/${config.accept_limit}). Stopping.`);
      db.prepare('UPDATE config SET is_running = 0 WHERE user_id = ?').run(userId);
      if (broadcastFn) broadcastFn(userId, 'status_update', { isRunning: false });
      stopWorker(userId);
      processingUsers.delete(userId);
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
    const acceptLimit = config.accept_limit || 600;
    const currentCount = config.current_accepted_count || 0;

    if (currentCount >= acceptLimit) {
      log(userId, 'INFO', `🚫 Accept limit reached (${currentCount}/${acceptLimit}). Stopping auto mode.`);
      db.prepare('UPDATE config SET is_running = 0 WHERE user_id = ?').run(userId);
      if (broadcastFn) broadcastFn(userId, 'status_update', { isRunning: false });
      stopWorker(userId);
      processingUsers.delete(userId);
      return;
    }

    log(userId, 'FETCH', '🔄 Starting lead fetch cycle…');

    let leads;
    try {
      leads = await fetchRecentLeads(config.cookies, proxyUrl);
    } catch (err) {
      if (err.code === 'SESSION_EXPIRED') {
        sessionExpiredUsers.add(userId);
        db.prepare('UPDATE config SET is_running = 0 WHERE user_id = ?').run(userId);
        log(userId, 'ERROR', '⚠️ Session expired — auto mode stopped. Please re-upload cookies.');
        if (broadcastFn) broadcastFn(userId, 'session_expired', {});
        stopWorker(userId);
        processingUsers.delete(userId);
        return;
      }
      log(userId, 'ERROR', `❌ Fetch failed: ${err.message}`);
      if (broadcastFn) broadcastFn(userId, 'cycle_done', { accepted: 0, skipped: 0, total: 0, error: err.message });
      processingUsers.delete(userId);
      return;
    }

    log(userId, 'INFO', `📥 Fetched ${leads.length} leads from IndiaMART`);

    // Sort by timestamp (newest first)
    leads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let accepted = 0, skipped = 0;

    for (const rawLead of leads) {
      // Null-safe — ensure all string fields are strings
      const lead = {
        ...rawLead,
        product      : String(rawLead.product || ''),
        message      : String(rawLead.message || ''),
        country      : String(rawLead.country || ''),
        customer_name: String(rawLead.customer_name || ''),
        company_name : String(rawLead.company_name || ''),
        mobile       : String(rawLead.mobile || ''),
        email        : String(rawLead.email || ''),
      };

      // Skip leads already in the database for this specific user
      const existing = db.prepare('SELECT id, status, replied FROM leads WHERE lead_id = ? AND user_id = ?').get(lead.lead_id, userId);
      if (existing) continue;

      // AI Scoring — runs on every lead
      const { score, priority } = scoreLead(lead);
      const medicines = extractMedicineNames(`${lead.product || ''} ${lead.message || ''}`);
      const tags = extractTags(lead);
      const medicineStr = medicines.join(', ');

      // Skip conditions
      if (isEmpty(lead)) {
        db.prepare(`INSERT OR REPLACE INTO leads (user_id,lead_id,customer_name,company_name,product,medicine_name,country,mobile,email,quantity,message,timestamp,status,reason,ai_score,priority,tags,replied) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`)
          .run(userId, lead.lead_id, lead.customer_name, lead.company_name, lead.product, medicineStr, lead.country, lead.mobile, lead.email, lead.quantity, lead.message, new Date().toISOString(), 'Skipped', 'Empty inquiry', score, priority, JSON.stringify(tags));
        skipped++; continue;
      }
      if (isSpam(lead)) {
        db.prepare(`INSERT OR REPLACE INTO leads (user_id,lead_id,customer_name,company_name,product,medicine_name,country,mobile,email,quantity,message,timestamp,status,reason,ai_score,priority,tags,replied) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`)
          .run(userId, lead.lead_id, lead.customer_name, lead.company_name, lead.product, medicineStr, lead.country, lead.mobile, lead.email, lead.quantity, lead.message, new Date().toISOString(), 'Skipped', 'Spam detected', score, priority, JSON.stringify(tags));
        skipped++; continue;
      }

      // Keyword filter
      let keywordMatch = keywords.length === 0;
      if (!keywordMatch) {
        const text = `${lead.product} ${lead.message}`.toLowerCase();
        keywordMatch = keywords.some(kw => text.includes(kw));
      }

      // Country filter
      let countryMatch = countries.length === 0;
      if (!countryMatch) {
        const nc = normaliseCountry(lead.country);
        countryMatch = countries.some(c => nc.includes(c) || lead.country.toLowerCase().includes(c));
      }

      // Quantity filter
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
        INSERT INTO leads (user_id,lead_id,customer_name,company_name,product,medicine_name,country,mobile,email,quantity,message,call_details,timestamp,status,reason,replied,ai_score,priority,tags)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)
        ON CONFLICT(user_id, lead_id) DO UPDATE SET
          status=excluded.status, reason=excluded.reason,
          ai_score=excluded.ai_score, priority=excluded.priority,
          tags=excluded.tags, medicine_name=excluded.medicine_name
      `).run(
        userId, lead.lead_id, lead.customer_name, lead.company_name, lead.product,
        medicineStr, lead.country, lead.mobile, lead.email, lead.quantity,
        lead.message, lead.call_details || '', new Date().toISOString(),
        status, reason, score, priority, JSON.stringify(tags)
      );

      if (isAccepted) {
        accepted++;
        db.prepare('UPDATE config SET current_accepted_count = current_accepted_count + 1 WHERE user_id = ?').run(userId);

        const priorityEmoji = priority === 'High' ? '🔥' : priority === 'Medium' ? '⭐' : '';
        log(userId, 'ACCEPT', `✅ ${priorityEmoji} Accepted [Score:${score}]: ${lead.customer_name} | ${lead.product} | ${lead.country}`);

        // Check limit
        const check = db.prepare('SELECT current_accepted_count, accept_limit FROM config WHERE user_id = ?').get(userId);
        if (check.current_accepted_count >= check.accept_limit) {
          log(userId, 'INFO', `🚫 Accept limit reached. Stopping.`);
          db.prepare('UPDATE config SET is_running = 0 WHERE user_id = ?').run(userId);
          if (broadcastFn) broadcastFn(userId, 'status_update', { isRunning: false });
          stopWorker(userId);
          break;
        }

        // Auto reply
        if (replyEnabled) {
          await randomDelay(2000, 5000);
          try {
            const msg = buildReplyMessage(replyMsg, lead);
            await sendMessage(config.cookies, lead.lead_id, msg, proxyUrl);
            db.prepare('UPDATE leads SET replied = 1 WHERE lead_id = ? AND user_id = ?').run(lead.lead_id, userId);
            log(userId, 'REPLY', `💬 Replied to lead ${lead.lead_id}`);
          } catch (e) {
            log(userId, 'ERROR', `Reply failed for ${lead.lead_id}: ${e.message}`);
          }
        }

        // Telegram notification (with priority + AI score)
        if (tgToken && tgChatId) {
          const priorityLabel = priority === 'High' ? '🔥 HIGH PRIORITY' : priority === 'Medium' ? '⭐ Medium' : 'Low';
          await sendTelegramNotification(
            tgToken, tgChatId,
            `🎯 <b>New Lead Accepted!</b>\n${priorityLabel} | Score: ${score}/100\n👤 ${lead.customer_name}\n🏢 ${lead.company_name}\n💊 ${medicineStr || lead.product}\n🌍 ${lead.country}\n📞 ${lead.mobile || 'N/A'}\n📦 Qty: ${lead.quantity || 'N/A'}`
          );
        }

        // Broadcast to SSE clients
        if (broadcastFn) {
          broadcastFn(userId, 'lead_captured', { ...lead, ai_score: score, priority, medicine_name: medicineStr, tags });
          // Extra broadcast for high-priority leads
          if (priority === 'High') {
            broadcastFn(userId, 'priority_lead', { ...lead, ai_score: score, priority, medicine_name: medicineStr });
          }
        }
      } else {
        skipped++;
        log(userId, 'SKIP', `⏭️ Skipped [Score:${score}]: ${lead.customer_name} | ${reason}`);
      }
    }

    log(userId, 'INFO', `✔️ Cycle done — Accepted: ${accepted}, Skipped: ${skipped}`);
    if (broadcastFn) broadcastFn(userId, 'cycle_done', { accepted, skipped, total: leads.length });
    processingUsers.delete(userId);

  } catch (err) {
    log(userId, 'ERROR', `Critical worker error: ${err.message}`);
    processingUsers.delete(userId);
  }

  // Update DB stats cache
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='Accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status='Skipped'  THEN 1 ELSE 0 END) as skipped,
        SUM(replied) as replied,
        SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) as high_priority
      FROM leads
      WHERE user_id = ?
    `).get(userId);
    if (broadcastFn) broadcastFn(userId, 'stats', stats);
  } catch (err) {
    console.error(`[Worker Stats Error] Failed to fetch stats for user ${userId}: ${err.message}`);
  }
}

/* ── Worker control ────────────────────────────────────────────── */
function startWorker(userId, broadcast) {
  if (activeTimers.has(userId)) return;
  if (broadcast) broadcastFn = broadcast;

  sessionExpiredUsers.delete(userId);
  const config = db.prepare('SELECT interval FROM config WHERE user_id = ?').get(userId);
  const intervalMs = Math.max(10, config?.interval || 30) * 1000;

  log(userId, 'INFO', `🚀 Auto mode started — interval ${intervalMs / 1000}s`);
  
  // Run cycle asynchronously
  runCycle(userId);
  
  const timer = setInterval(() => runCycle(userId), intervalMs);
  activeTimers.set(userId, timer);
}

function stopWorker(userId) {
  const timer = activeTimers.get(userId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(userId);
    log(userId, 'INFO', '⛔ Auto mode stopped');
  }
  processingUsers.delete(userId);
  sessionExpiredUsers.delete(userId);
}

function isWorkerRunning(userId) { return activeTimers.has(userId); }
function isSessionExpiredState(userId) { return sessionExpiredUsers.has(userId); }
function setBroadcast(fn) { broadcastFn = fn; }

module.exports = { startWorker, stopWorker, isWorkerRunning, isSessionExpiredState, setBroadcast };
