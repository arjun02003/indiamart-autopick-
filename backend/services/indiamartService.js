const axios = require('axios');

const BASE_URL           = 'https://seller.indiamart.com';
const CONTACT_LIST_URL   = `${BASE_URL}/lmsreact/getContactList`;
const SEND_MESSAGE_URL   = `${BASE_URL}/lmsreact/sendMessage`;

// ── Headers that mirror a real browser session ───────────────────────
const DEFAULT_HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept'         : 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer'        : 'https://seller.indiamart.com/leadmanager/',
  'Origin'         : BASE_URL,
  'X-Requested-With': 'XMLHttpRequest',
  'Connection'     : 'keep-alive',
};

/* ── Cookie parser — handles JSON array, JSON object, or raw string ── */
function parseCookies(raw) {
  if (!raw) return '';
  try {
    const str = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
    if (str.startsWith('[')) {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map(c => `${c.name}=${c.value}`).join('; ');
    }
    if (str.startsWith('{')) {
      const obj = JSON.parse(str);
      return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    // If already a raw cookie string
    if (typeof raw === 'string' && raw.includes('=')) return raw;
  } catch (_) {}
  // Fallback: if raw is an array
  if (Array.isArray(raw)) return raw.map(c => `${c.name}=${c.value}`).join('; ');
  return typeof raw === 'string' ? raw : '';
}

/* ── Session expiry detection ────────────────────────────────────────*/
function isSessionExpired(data) {
  if (typeof data === 'string') {
    const lower = data.toLowerCase();
    if (lower.includes('<html') && (lower.includes('login') || lower.includes('signin'))) return true;
  }
  if (data && typeof data === 'object') {
    const code = String(data.STATUS || data.status || data.CODE || data.code || '');
    if (['SESSION_EXPIRED', '401', 'INVALID_SESSION', 'GLID_MISSING'].includes(code)) return true;
    const msg = String(data.message || data.MESSAGE || data.msg || '').toLowerCase();
    if (msg.includes('session') || msg.includes('login') || msg.includes('unauthori')) return true;
  }
  return false;
}

/* ── Quantity parser — tries direct fields then regex on message ─────*/
function parseQuantity(lead) {
  const directFields = [
    'last_product_qty', 'QUERY_PRODUCT_QUANTITY', 'QUANTITY', 'quantity', 
    'ORDER_QTY', 'qty', 'I_QTY', 'PRODUCT_QTY', 'QUERY_PRODUCT_QTY', 'PRD_QTY'
  ];
  for (const f of directFields) {
    if (lead[f] !== undefined && lead[f] !== null && lead[f] !== '') {
      const n = parseFloat(String(lead[f]).replace(/[^0-9.]/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  const textFields = ['last_message', 'QUERY_MSSAGE', 'QUERY_MESSAGE', 'message', 'SUBJECT', 'subject'];
  for (const f of textFields) {
    if (lead[f]) {
      const m = String(lead[f]).match(
        /(\d+(?:\.\d+)?)\s*(?:units?|pcs?|pieces?|tablets?|bottles?|boxes?|kgs?|grams?|mg|strips?|cartons?|dozens?|nos?\.?)/i
      );
      if (m) return parseFloat(m[1]);
    }
  }
  return 0;
}

/* ── Build proxy config from URL string ──────────────────────────────*/
function buildProxy(proxyUrl) {
  if (!proxyUrl || !proxyUrl.trim()) return undefined;
  try {
    const u = new URL(proxyUrl);
    return {
      protocol: u.protocol.replace(':', ''),
      host    : u.hostname,
      port    : parseInt(u.port) || 80,
      ...(u.username ? { auth: { username: u.username, password: u.password } } : {}),
    };
  } catch (_) { return undefined; }
}

/* ── Normalise a raw IndiaMART lead object ───────────────────────────*/
function normalizeLead(lead) {
  return {
    lead_id      : String(lead.im_contact_id || lead.contacts_glid || lead.I_REQ_ID || lead.QUERY_ID || Math.random().toString(36).slice(2)),
    customer_name: lead.contacts_name  || lead.SENDER_NAME  || lead.NAME || 'Unknown',
    company_name : lead.contacts_company || lead.SENDER_COMPANY || lead.COMP_NAME || '',
    product      : lead.contact_last_product || lead.QUERY_PRODUCT_NAME || lead.PROD_NAME || lead.subject || '',
    country      : lead.country_name   || lead.SENDER_COUNTRY || lead.COUNTRY || 'Unknown',
    mobile       : lead.contacts_mobile1 || lead.SENDER_MOBILE  || lead.MOBILE || '',
    email        : lead.contacts_email   || lead.SENDER_EMAIL   || '',
    quantity     : parseQuantity(lead),
    message      : lead.last_message     || lead.QUERY_MSSAGE   || lead.QUERY_MESSAGE || '',
  };
}

/* ── Retry helper ────────────────────────────────────────────────────*/
async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (err.code === 'SESSION_EXPIRED') throw err;   // no point retrying
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

/* ── fetchLeads ──────────────────────────────────────────────────────
   The real IndiaMART API accepts:
     POST https://seller.indiamart.com/lmsreact/getContactList
     Body: {}   (empty JSON object)
     Content-Type: application/json
   Response key is `result` (array of leads)
*/
async function fetchLeads(cookiesRaw, proxyUrl = '') {
  const cookieString = parseCookies(cookiesRaw);
  if (!cookieString) throw new Error('No valid cookies provided');

  return withRetry(async () => {
    const response = await axios.post(
      CONTACT_LIST_URL,
      {},                          // ← empty JSON body (NOT urlencoded)
      {
        headers: {
          ...DEFAULT_HEADERS,
          'Cookie'      : cookieString,
          'Content-Type': 'application/json',
        },
        proxy   : buildProxy(proxyUrl),
        timeout : 30000,
        maxRedirects: 5,
      }
    );

    const data = response.data;

    // Log raw response shape for debugging
    console.log('[IndiaMART] Raw response keys:', typeof data === 'object' ? Object.keys(data).join(', ') : typeof data);

    if (isSessionExpired(data)) {
      const e = new Error('SESSION_EXPIRED'); e.code = 'SESSION_EXPIRED'; throw e;
    }

    // Try all known response shapes — most common first
    const leads =
      data.result            ||   // ← primary key seen in real responses
      data.RESPONSE          ||
      data.response          ||
      data.leads             ||
      data.data              ||
      data.Results           ||
      data.enquiries         ||
      (Array.isArray(data) ? data : null);

    if (!leads) {
      // Dump the actual shape so it appears in the activity log
      throw new Error(`Unknown response shape. Top-level keys: ${Object.keys(data).join(', ')} | Sample: ${JSON.stringify(data).slice(0, 300)}`);
    }

    if (!Array.isArray(leads)) {
      throw new Error(`"leads" field is not an array: ${JSON.stringify(leads).slice(0, 200)}`);
    }

    console.log(`[IndiaMART] Parsed ${leads.length} leads from response.`);
    return leads.map(normalizeLead);
  });
}

/* ── sendMessage ─────────────────────────────────────────────────────
   POST https://seller.indiamart.com/lmsreact/sendMessage
   Body: JSON  { I_REQ_ID, msgbody, type }
*/
async function sendMessage(cookiesRaw, leadId, messageText, proxyUrl = '') {
  const cookieString = parseCookies(cookiesRaw);
  if (!cookieString) throw new Error('No valid cookies provided');

  return withRetry(async () => {
    const response = await axios.post(
      SEND_MESSAGE_URL,
      { I_REQ_ID: leadId, msgbody: messageText, type: 'REPLY' },  // JSON body
      {
        headers: {
          ...DEFAULT_HEADERS,
          'Cookie'      : cookieString,
          'Content-Type': 'application/json',
        },
        proxy  : buildProxy(proxyUrl),
        timeout: 15000,
      }
    );

    const data = response.data;
    if (isSessionExpired(data)) {
      const e = new Error('SESSION_EXPIRED'); e.code = 'SESSION_EXPIRED'; throw e;
    }

    // A 0 / '0' STATUS usually means success on IndiaMART
    // Failure is indicated by error fields
    if (data.error || data.ERROR) {
      throw new Error(data.message || data.MESSAGE || data.error || 'sendMessage failed');
    }

    return { success: true, data };
  });
}

module.exports = { fetchLeads, sendMessage, parseCookies };
