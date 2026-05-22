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
    if (['SESSION_EXPIRED', '401', '402', 'INVALID_SESSION', 'GLID_MISSING', 'TOKEN_EXPIRED'].includes(code)) return true;
    const msg = String(data.message || data.MESSAGE || data.msg || '').toLowerCase();
    if (msg.includes('session') || msg.includes('login') || msg.includes('unauthori') || msg.includes('expired') || msg.includes('token')) return true;
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
    timestamp    : lead.contacts_updated_at || lead.I_QUERY_TIME || lead.QUERY_TIME || new Date().toISOString()
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
   Paginates through ALL pages of IndiaMART leads.
   IndiaMART caps each response at 50 leads regardless of limit,
   so we loop with start=0, 50, 100... until an empty page is returned.
*/
async function fetchLeads(cookiesRaw, proxyUrl = '') {
  const cookieString = parseCookies(cookiesRaw);
  if (!cookieString) throw new Error('No valid cookies provided');

  const PAGE_SIZE  = 50;   // IndiaMART hard-caps at 50 per response
  const MAX_PAGES  = 20;   // safety cap — fetch at most 1000 leads
  const allLeads   = [];
  let lastContactDate = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop
    const pageLeads = await withRetry(async () => {
      const payload = {
        page: 1, // Always page: 1 when using last_contact_date
        limit : PAGE_SIZE,
        modid : 'ALL',
        folder: 'ALL',
      };
      if (lastContactDate) {
        payload.last_contact_date = lastContactDate;
      }

      const response = await axios.post(
        CONTACT_LIST_URL,
        payload,
        {
          headers: {
            ...DEFAULT_HEADERS,
            'Cookie'      : cookieString,
            'Content-Type': 'application/json',
          },
          proxy  : buildProxy(proxyUrl),
          timeout: 60000,
        }
      );

      const data = response.data;

      if (isSessionExpired(data)) {
        const e = new Error('SESSION_EXPIRED'); e.code = 'SESSION_EXPIRED'; throw e;
      }

      // Try all known response shapes — most common first
      const leads =
        data.result    ||
        data.RESPONSE  ||
        data.response  ||
        data.leads     ||
        data.data      ||
        data.Results   ||
        data.enquiries ||
        (Array.isArray(data) ? data : null);

      if (!leads) {
        if (page === 1) {
          throw new Error(
            `Unknown response shape. Top-level keys: ${Object.keys(data).join(', ')} | Sample: ${JSON.stringify(data).slice(0, 300)}`
          );
        }
        return [];
      }

      if (!Array.isArray(leads)) {
        if (page === 1) throw new Error(`"leads" field is not an array: ${JSON.stringify(leads).slice(0, 200)}`);
        return [];
      }

      return leads;
    });

    if (pageLeads.length === 0) {
      console.log(`[IndiaMART] Page ${page}: no leads – stopping pagination.`);
      break;
    }

    console.log(`[IndiaMART] Page ${page}: fetched ${pageLeads.length} leads.`);
    allLeads.push(...pageLeads.map(normalizeLead));

    if (pageLeads.length < PAGE_SIZE) break;

    const lastLead = pageLeads[pageLeads.length - 1];
    const newLastContactDate = lastLead.last_contact_date;

    // Check if the cursor didn't change to avoid infinite loop
    if (newLastContactDate && lastContactDate === newLastContactDate) {
      console.log(`[IndiaMART] Page ${page}: last_contact_date did not change (${newLastContactDate}) – stopping.`);
      break;
    }
    lastContactDate = newLastContactDate;

    // Small polite delay between pages so IndiaMART doesn't rate-limit us
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`[IndiaMART] Total leads fetched across all pages: ${allLeads.length}`);
  return allLeads;
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
      { I_REQ_ID: leadId, msgbody: messageText, type: 'QUERY' },  // QUERY is more visible than REPLY
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

module.exports = { fetchLeads, fetchRecentLeads, sendMessage, parseCookies };

/* ── fetchRecentLeads ────────────────────────────────────────────────
   Fetches up to 200 leads (4 pages × 50) for the worker cycle.
   Stops early if a page returns < 50 leads (end of results).
*/
async function fetchRecentLeads(cookiesRaw, proxyUrl = '') {
  const cookieString = parseCookies(cookiesRaw);
  if (!cookieString) throw new Error('No valid cookies provided');

  const MAX_PAGES = 4; // 4 × 50 = 200 leads max
  const allLeads  = [];
  let lastContactDate = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop
    const pageLeads = await withRetry(async () => {
      const payload = {
        page: 1, // Always page 1 when using last_contact_date cursor
        limit: 50,
        modid: 'ALL',
        folder: 'ALL'
      };
      if (lastContactDate) {
        payload.last_contact_date = lastContactDate;
      }

      const response = await axios.post(
        CONTACT_LIST_URL,
        payload,
        {
          headers: { ...DEFAULT_HEADERS, 'Cookie': cookieString, 'Content-Type': 'application/json' },
          proxy  : buildProxy(proxyUrl),
          timeout: 60000,
        }
      );

      const data = response.data;
      if (isSessionExpired(data)) {
        const e = new Error('SESSION_EXPIRED'); e.code = 'SESSION_EXPIRED'; throw e;
      }

      const leads = data.result || data.RESPONSE || data.response || data.leads ||
                    data.data || data.Results || data.enquiries ||
                    (Array.isArray(data) ? data : null);

      if (!leads || !Array.isArray(leads)) return [];
      return leads;
    });

    if (pageLeads.length === 0) break;
    allLeads.push(...pageLeads.map(normalizeLead));
    if (pageLeads.length < 50) break; // last page

    const lastLead = pageLeads[pageLeads.length - 1];
    const newLastContactDate = lastLead.last_contact_date;

    // Check if the cursor didn't change to avoid infinite loop
    if (newLastContactDate && lastContactDate === newLastContactDate) {
      console.log(`[IndiaMART] fetchRecentLeads: last_contact_date did not change (${newLastContactDate}) – stopping.`);
      break;
    }
    lastContactDate = newLastContactDate;

    // Small polite delay between pages so IndiaMART doesn't rate-limit us
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`[IndiaMART] Recent fetch: ${allLeads.length} leads`);
  return allLeads;
}
