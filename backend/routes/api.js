const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const axios    = require('axios');
const { parseCookies } = require('../services/indiamartService');
const { sendTelegramNotification } = require('../services/telegramService');
const { sendMessage }  = require('../services/indiamartService');
const { scoreLead, extractMedicineNames, extractTags } = require('../services/aiScoringService');
const worker   = require('../worker');

/* ── Optional: xlsx for Excel export (graceful fallback) ─────────────── */
let xlsx;
try { xlsx = require('xlsx'); } catch (_) { xlsx = null; }

/* ═══════════════════════════════════════════════════════════════
   DEBUG — returns raw first lead + all keys
═══════════════════════════════════════════════════════════════ */
router.get('/debug/raw-leads', async (_req, res) => {
  const config = db.prepare('SELECT cookies FROM config WHERE id = 1').get();
  const cookieString = parseCookies(config?.cookies || '');
  if (!cookieString) return res.status(400).json({ error: 'No cookies saved yet' });

  try {
    const response = await axios.post(
      'https://seller.indiamart.com/lmsreact/getContactList',
      {},
      {
        headers: {
          'Cookie'        : cookieString,
          'User-Agent'    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Content-Type'  : 'application/json',
          'Accept'        : 'application/json, text/plain, */*',
          'Referer'       : 'https://seller.indiamart.com/leadmanager/',
          'Origin'        : 'https://seller.indiamart.com',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 20000,
      }
    );

    const data   = response.data;
    const topKeys = typeof data === 'object' && data !== null ? Object.keys(data) : [];
    const leads = data.result || data.RESPONSE || data.response || data.leads || data.data || data.Results || data.enquiries || (Array.isArray(data) ? data : []);
    const firstLead   = Array.isArray(leads) && leads.length > 0 ? leads[0]   : null;

    res.json({
      topLevelKeys : topKeys,
      leadsCount   : Array.isArray(leads) ? leads.length : 0,
      firstLeadKeys: firstLead ? Object.keys(firstLead) : [],
      firstLead    : firstLead || {},
      rawSample    : JSON.stringify(data).slice(0, 1000),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */

router.get('/config', (_req, res) => {
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  res.json({ success: true, config });
});

router.post('/config', (req, res) => {
  const {
    keywords, countries, interval, cookies,
    auto_reply_msg, telegram_token, telegram_chat_id,
    proxy_url, min_quantity, reply_enabled,
    accept_limit, priority_keywords,
  } = req.body;

  db.prepare(`
    UPDATE config SET
      keywords         = COALESCE(?, keywords),
      countries        = COALESCE(?, countries),
      priority_keywords = COALESCE(?, priority_keywords),
      interval         = COALESCE(?, interval),
      cookies          = COALESCE(?, cookies),
      auto_reply_msg   = COALESCE(?, auto_reply_msg),
      telegram_token   = COALESCE(?, telegram_token),
      telegram_chat_id = COALESCE(?, telegram_chat_id),
      proxy_url        = COALESCE(?, proxy_url),
      min_quantity     = COALESCE(?, min_quantity),
      reply_enabled    = COALESCE(?, reply_enabled),
      accept_limit     = COALESCE(?, accept_limit)
    WHERE id = 1
  `).run(
    keywords   != null ? JSON.stringify(keywords) : null,
    countries  != null ? JSON.stringify(countries) : null,
    priority_keywords != null ? JSON.stringify(priority_keywords) : null,
    interval   != null ? interval : null,
    cookies    != null ? (typeof cookies === 'string' ? cookies : JSON.stringify(cookies)) : null,
    auto_reply_msg   ?? null,
    telegram_token   ?? null,
    telegram_chat_id ?? null,
    proxy_url        ?? null,
    min_quantity     != null ? min_quantity : null,
    reply_enabled    != null ? (reply_enabled ? 1 : 0) : null,
    accept_limit     != null ? accept_limit : null,
  );

  res.json({ success: true, message: 'Config saved' });
});

/* ═══════════════════════════════════════════════════════════════
   COOKIES
═══════════════════════════════════════════════════════════════ */

router.post('/upload-cookies', (req, res) => {
  const { cookies } = req.body;
  if (!cookies) return res.status(400).json({ error: 'No cookies provided' });

  const cookieStr = parseCookies(cookies);
  if (!cookieStr) return res.status(400).json({ error: 'Invalid cookie format' });

  const raw = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
  db.prepare('UPDATE config SET cookies = ? WHERE id = 1').run(raw);
  res.json({ success: true, message: 'Cookies saved', preview: cookieStr.slice(0, 80) + '…' });
});

/* ── Chrome Extension: POST /api/login-cookies ───────────────────────── */
router.post('/login-cookies', (req, res) => {
  const { cookies } = req.body;
  if (!cookies) return res.status(400).json({ error: 'No cookies provided' });

  const cookieStr = parseCookies(cookies);
  if (!cookieStr) return res.status(400).json({ error: 'Invalid cookie format' });

  const raw = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
  db.prepare('UPDATE config SET cookies = ? WHERE id = 1').run(raw);
  res.json({ success: true, message: 'Cookies saved from Chrome Extension', preview: cookieStr.slice(0, 80) + '…' });
});

/* ═══════════════════════════════════════════════════════════════
   AUTO MODE
═══════════════════════════════════════════════════════════════ */

router.post('/start', (req, res) => {
  // Guard: already running
  if (worker.isWorkerRunning()) {
    return res.json({ success: true, message: 'Already running' });
  }
  // Guard: no cookies saved
  const cfg = db.prepare('SELECT cookies FROM config WHERE id = 1').get();
  const hasCookies = cfg && cfg.cookies && cfg.cookies.length > 10 && cfg.cookies !== '[]';
  if (!hasCookies) {
    return res.status(400).json({ success: false, message: 'No cookies found. Please upload IndiaMART cookies in Settings first.' });
  }
  const app = req.app;
  db.prepare('UPDATE config SET is_running = 1 WHERE id = 1').run();
  worker.startWorker(app.locals.broadcast);
  res.json({ success: true, message: 'Auto mode started' });
});

router.post('/stop', (_req, res) => {
  db.prepare('UPDATE config SET is_running = 0 WHERE id = 1').run();
  worker.stopWorker();
  res.json({ success: true, message: 'Auto mode stopped' });
});

router.get('/status', (_req, res) => {
  res.json({
    running        : worker.isWorkerRunning(),
    sessionExpired : worker.isSessionExpiredState(),
  });
});

/* ═══════════════════════════════════════════════════════════════
   LEADS
═══════════════════════════════════════════════════════════════ */

// GET paginated leads with advanced search + filters
router.get('/leads', (req, res) => {
  const {
    page = 1, limit = 50,
    search = '', status = '',
    country = '', medicine = '',
    priority = '', min_score = 0,
  } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where   = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (customer_name LIKE ? OR company_name LIKE ? OR product LIKE ? OR country LIKE ? OR mobile LIKE ? OR medicine_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }
  if (status)   { where += ' AND status = ?';   params.push(status); }
  if (country)  { where += ' AND country LIKE ?'; params.push(`%${country}%`); }
  if (medicine) { where += ' AND (product LIKE ? OR medicine_name LIKE ? OR message LIKE ?)'; params.push(`%${medicine}%`, `%${medicine}%`, `%${medicine}%`); }
  if (priority) { where += ' AND priority = ?'; params.push(priority); }
  if (parseInt(min_score) > 0) { where += ' AND ai_score >= ?'; params.push(parseInt(min_score)); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM leads ${where}`).get(...params).cnt;
  const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY ai_score DESC, id DESC LIMIT ? OFFSET ?`)
                   .all(...params, parseInt(limit), offset);

  res.json({ success: true, leads, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET stats
router.get('/stats', (_req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='Accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='Skipped'  THEN 1 ELSE 0 END) as skipped,
      SUM(replied) as replied,
      SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) as high_priority,
      AVG(ai_score) as avg_score
    FROM leads
  `).get();

  const config = db.prepare('SELECT accept_limit, current_accepted_count FROM config WHERE id = 1').get();

  // Top countries
  const topCountries = db.prepare(`
    SELECT country, COUNT(*) as count FROM leads
    WHERE country IS NOT NULL AND country != '' AND country != 'Unknown'
    GROUP BY country ORDER BY count DESC LIMIT 5
  `).all();

  // Top medicines
  const topMedicines = db.prepare(`
    SELECT medicine_name, COUNT(*) as count FROM leads
    WHERE medicine_name IS NOT NULL AND medicine_name != ''
    GROUP BY medicine_name ORDER BY count DESC LIMIT 5
  `).all();

  res.json({
    success: true,
    stats: {
      ...stats,
      high_priority: stats.high_priority || 0,
      avg_score: Math.round(stats.avg_score || 0),
      limit: config.accept_limit,
      current: config.current_accepted_count,
    },
    topCountries,
    topMedicines,
  });
});

// GET high-priority leads
router.get('/leads/priority', (req, res) => {
  const { limit = 20 } = req.query;
  const leads = db.prepare(`
    SELECT * FROM leads WHERE priority = 'High' AND status = 'Accepted'
    ORDER BY ai_score DESC, id DESC LIMIT ?
  `).all(parseInt(limit));
  res.json({ success: true, leads, total: leads.length });
});

// POST reset current accepted count
router.post('/reset-counter', (_req, res) => {
  db.prepare('UPDATE config SET current_accepted_count = 0 WHERE id = 1').run();
  res.json({ success: true, message: 'Accepted counter reset' });
});

// POST manual accept a lead
router.post('/leads/:id/accept', async (req, res) => {
  const { id } = req.params;
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  const lead   = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);

  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  db.prepare('UPDATE leads SET status = ?, reason = ? WHERE id = ?').run('Accepted', 'Manually accepted', id);

  if (config.reply_enabled && config.cookies) {
    try {
      const replyMsg = (config.auto_reply_msg || 'Thank you for your inquiry.')
        .replace(/\{name\}/gi, lead.customer_name || '')
        .replace(/\{product\}/gi, lead.product || '');
      await sendMessage(config.cookies, lead.lead_id, replyMsg, config.proxy_url);
      db.prepare('UPDATE leads SET replied = 1 WHERE id = ?').run(id);
    } catch (e) {
      console.warn('[ManualAccept] Reply failed:', e.message);
    }
  }

  res.json({ success: true, message: 'Lead accepted and reply sent' });
});

// POST manual skip a lead
router.post('/leads/:id/skip', (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE leads SET status = 'Skipped', reason = 'Manually skipped' WHERE id = ?").run(id);
  res.json({ success: true });
});

// POST add/update tags on a lead
router.post('/leads/:id/tag', (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });
  db.prepare('UPDATE leads SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id);
  res.json({ success: true, message: 'Tags updated' });
});

/* ── Chrome Extension: POST /api/capture ─────────────────────────────── */
router.post('/capture', (req, res) => {
  const lead = req.body;
  if (!lead || !lead.lead_id) return res.status(400).json({ error: 'lead_id required' });

  const { score, priority } = scoreLead(lead);
  const medicines = extractMedicineNames(`${lead.product || ''} ${lead.message || ''}`);
  const tags = extractTags(lead);

  try {
    db.prepare(`
      INSERT INTO leads (lead_id, customer_name, company_name, product, medicine_name, country, mobile, email, quantity, message, call_details, timestamp, status, reason, ai_score, priority, tags, replied)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Captured via Extension', ?, ?, ?, 0)
      ON CONFLICT(lead_id) DO UPDATE SET
        ai_score = excluded.ai_score,
        priority = excluded.priority,
        tags = excluded.tags
    `).run(
      lead.lead_id, lead.customer_name || 'Unknown', lead.company_name || '',
      lead.product || '', medicines.join(', '), lead.country || 'Unknown',
      lead.mobile || '', lead.email || '', lead.quantity || 0,
      lead.message || '', lead.call_details || '',
      lead.timestamp || new Date().toISOString(),
      score, priority, JSON.stringify(tags)
    );

    // Broadcast SSE
    const app = req.app;
    if (app.locals.broadcast) {
      app.locals.broadcast('lead_captured', { ...lead, ai_score: score, priority });
    }

    res.json({ success: true, message: 'Lead captured', ai_score: score, priority });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Re-score all leads ───────────────────────────────────────────────── */
router.post('/leads/rescore', (req, res) => {
  const leads = db.prepare('SELECT * FROM leads').all();
  let updated = 0;
  const updateStmt = db.prepare('UPDATE leads SET ai_score = ?, priority = ?, tags = ?, medicine_name = ? WHERE id = ?');

  for (const lead of leads) {
    const { score, priority } = scoreLead(lead);
    const medicines = extractMedicineNames(`${lead.product || ''} ${lead.message || ''}`);
    const tags = extractTags(lead);
    updateStmt.run(score, priority, JSON.stringify(tags), medicines.join(', '), lead.id);
    updated++;
  }

  res.json({ success: true, message: `Re-scored ${updated} leads` });
});

/* ═══════════════════════════════════════════════════════════════
   DUPLICATE REMOVAL
═══════════════════════════════════════════════════════════════ */

// DELETE duplicate leads — keeps highest-scored duplicate
router.delete('/leads/duplicates', (req, res) => {
  // Find duplicates by mobile + product (same buyer, same product)
  const duplicates = db.prepare(`
    SELECT MIN(id) as keep_id, mobile, product, COUNT(*) as cnt
    FROM leads
    WHERE mobile != '' AND mobile IS NOT NULL
    GROUP BY mobile, product
    HAVING cnt > 1
  `).all();

  let removed = 0;
  for (const dup of duplicates) {
    // Keep the one with the highest AI score; delete the rest
    const toDelete = db.prepare(`
      SELECT id FROM leads
      WHERE mobile = ? AND product = ? AND id != (
        SELECT id FROM leads WHERE mobile = ? AND product = ?
        ORDER BY ai_score DESC, id DESC LIMIT 1
      )
    `).all(dup.mobile, dup.product, dup.mobile, dup.product);

    for (const row of toDelete) {
      db.prepare('DELETE FROM leads WHERE id = ?').run(row.id);
      removed++;
    }
  }

  res.json({ success: true, message: `Removed ${removed} duplicate leads` });
});

/* ═══════════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════════ */

router.get('/export', (req, res) => {
  const { format = 'csv', status = '', priority = '' } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (status)   { where += ' AND status = ?';   params.push(status); }
  if (priority) { where += ' AND priority = ?'; params.push(priority); }

  const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY ai_score DESC, id DESC`).all(...params);

  // ── Excel ──
  if (format === 'excel') {
    if (!xlsx) return res.status(503).json({ error: 'xlsx package not installed. Run: npm install xlsx' });
    const wsData = [
      ['ID', 'Lead ID', 'Customer', 'Company', 'Product', 'Medicine', 'Country', 'Mobile', 'Email', 'Quantity', 'Message', 'Call Details', 'Status', 'Priority', 'AI Score', 'Tags', 'Replied', 'Timestamp'],
      ...leads.map(l => [
        l.id, l.lead_id, l.customer_name, l.company_name, l.product,
        l.medicine_name, l.country, l.mobile, l.email, l.quantity,
        l.message, l.call_details, l.status, l.priority, l.ai_score,
        l.tags, l.replied ? 'Yes' : 'No', l.timestamp,
      ]),
    ];
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Leads');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="leads.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  }

  // ── JSON ──
  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="leads.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(leads, null, 2));
  }

  // ── CSV (default) ──
  const cols = ['id','lead_id','customer_name','company_name','product','medicine_name','country','mobile','email','quantity','message','call_details','status','priority','ai_score','tags','replied','timestamp'];
  const rows = [cols.join(',')];
  for (const l of leads) {
    rows.push(cols.map(c => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(','));
  }

  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

/* ═══════════════════════════════════════════════════════════════
   LOGS
═══════════════════════════════════════════════════════════════ */

router.get('/logs', (req, res) => {
  const { limit = 200 } = req.query;
  const logs = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(parseInt(limit));
  res.json({ success: true, logs });
});

router.delete('/logs', (_req, res) => {
  db.prepare('DELETE FROM logs').run();
  res.json({ success: true, message: 'Logs cleared' });
});

/* ═══════════════════════════════════════════════════════════════
   TELEGRAM TEST
═══════════════════════════════════════════════════════════════ */

router.post('/telegram/test', async (req, res) => {
  const { token, chat_id } = req.body;
  if (!token || !chat_id) return res.status(400).json({ error: 'Token and chat_id required' });
  try {
    await sendTelegramNotification(token, chat_id, '✅ IndiaMART Lead System — Telegram connected successfully!');
    res.json({ success: true, message: 'Test notification sent!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CLEAR DATA
═══════════════════════════════════════════════════════════════ */

router.delete('/leads', (_req, res) => {
  db.prepare('DELETE FROM leads').run();
  res.json({ success: true, message: 'All leads cleared' });
});

module.exports = router;
