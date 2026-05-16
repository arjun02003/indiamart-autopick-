const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const axios    = require('axios');
const { parseCookies } = require('../services/indiamartService');
const { sendTelegramNotification } = require('../services/telegramService');
const { sendMessage }  = require('../services/indiamartService');
const worker   = require('../worker');

/* ═══════════════════════════════════════════════════════════════
   DEBUG — returns raw first lead + all keys so we can fix mapping
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

    // Try all known response wrappers
    const leads = data.result || data.RESPONSE || data.response || data.leads || data.data || data.Results || data.enquiries || (Array.isArray(data) ? data : []);
    const firstLead   = Array.isArray(leads) && leads.length > 0 ? leads[0]   : null;
    const firstKeys   = firstLead ? Object.keys(firstLead) : [];
    const firstValues = firstLead ? firstLead : {};

    res.json({
      topLevelKeys : topKeys,
      leadsCount   : Array.isArray(leads) ? leads.length : 0,
      firstLeadKeys: firstKeys,
      firstLead    : firstValues,
      rawSample    : JSON.stringify(data).slice(0, 1000),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */

// GET config
router.get('/config', (_req, res) => {
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  res.json({ success: true, config });
});

// POST save config
router.post('/config', (req, res) => {
  const {
    keywords, countries, interval, cookies,
    auto_reply_msg, telegram_token, telegram_chat_id,
    proxy_url, min_quantity, reply_enabled,
    accept_limit,
  } = req.body;

  db.prepare(`
    UPDATE config SET
      keywords         = COALESCE(?, keywords),
      countries        = COALESCE(?, countries),
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

/* ═══════════════════════════════════════════════════════════════
   AUTO MODE
═══════════════════════════════════════════════════════════════ */

router.post('/start', (req, res) => {
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

// GET paginated leads with search + filter
router.get('/leads', (req, res) => {
  const { page = 1, limit = 50, search = '', status = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where   = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (customer_name LIKE ? OR company_name LIKE ? OR product LIKE ? OR country LIKE ? OR mobile LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (status) { where += ' AND status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM leads ${where}`).get(...params).cnt;
  const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
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
      SUM(replied) as replied
    FROM leads
  `).get();

  const config = db.prepare('SELECT accept_limit, current_accepted_count FROM config WHERE id = 1').get();

  res.json({ 
    success: true, 
    stats: {
      ...stats,
      limit: config.accept_limit,
      current: config.current_accepted_count
    }
  });
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

  // Send reply if enabled
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

/* ═══════════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════════ */

router.get('/export', (req, res) => {
  const { format = 'csv', status = '' } = req.query;
  let where = ''; const params = [];
  if (status) { where = 'WHERE status = ?'; params.push(status); }

  const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY id DESC`).all(...params);

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="leads.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(leads, null, 2));
  }

  // CSV
  const cols = ['id','lead_id','customer_name','company_name','product','country','mobile','email','quantity','message','status','reason','replied','timestamp'];
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
