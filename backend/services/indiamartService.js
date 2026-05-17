const axios = require('axios');

const BASE_URL = 'https://seller.indiamart.com';

const CONTACT_LIST_URL =
  `${BASE_URL}/lmsreact/getContactList`;

const SEND_MESSAGE_URL =
  `${BASE_URL}/lmsreact/sendMessage`;

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

  'Accept':
    'application/json, text/plain, */*',

  'Accept-Language':
    'en-US,en;q=0.9',

  'Referer':
    'https://seller.indiamart.com/leadmanager/',

  'Origin':
    BASE_URL,

  'X-Requested-With':
    'XMLHttpRequest',

  'Connection':
    'keep-alive',
};

function parseCookies(raw) {
  if (!raw) return '';

  try {
    const str =
      typeof raw === 'string'
        ? raw.trim()
        : JSON.stringify(raw);

    if (str.startsWith('[')) {
      const arr = JSON.parse(str);

      return arr
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    }

    if (str.startsWith('{')) {
      const obj = JSON.parse(str);

      return Object.entries(obj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    if (str.includes('=')) return str;

  } catch (e) {}

  return '';
}

function buildProxy(proxyUrl) {
  if (!proxyUrl) return undefined;

  try {
    const u = new URL(proxyUrl);

    return {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: parseInt(u.port),

      ...(u.username
        ? {
            auth: {
              username: u.username,
              password: u.password
            }
          }
        : {})
    };

  } catch (e) {
    return undefined;
  }
}

function isSessionExpired(data) {

  if (typeof data === 'string') {
    const lower = data.toLowerCase();

    if (
      lower.includes('login') ||
      lower.includes('signin') ||
      lower.includes('session expired')
    ) {
      return true;
    }
  }

  if (typeof data === 'object') {

    const msg = JSON.stringify(data).toLowerCase();

    if (
      msg.includes('session') ||
      msg.includes('expired') ||
      msg.includes('login') ||
      msg.includes('unauthorized')
    ) {
      return true;
    }
  }

  return false;
}

function parseQuantity(lead) {

  const qtyFields = [
    'last_product_qty',
    'QUERY_PRODUCT_QUANTITY',
    'QUANTITY',
    'quantity',
    'qty'
  ];

  for (const field of qtyFields) {

    if (lead[field]) {

      const n = parseFloat(
        String(lead[field]).replace(/[^0-9.]/g, '')
      );

      if (!isNaN(n)) return n;
    }
  }

  const msg =
    lead.last_message ||
    lead.QUERY_MESSAGE ||
    '';

  const match = msg.match(
    /(\d+(?:\.\d+)?)\s*(pcs|pieces|units|boxes|kg|kgs|bottles|strips)/i
  );

  if (match) {
    return parseFloat(match[1]);
  }

  return 0;
}

function normalizeLead(lead) {

  return {
    lead_id:
      lead.im_contact_id ||
      lead.contacts_glid ||
      lead.I_REQ_ID,

    customer_name:
      lead.contacts_name ||
      lead.SENDER_NAME ||
      'Unknown',

    company_name:
      lead.contacts_company ||
      lead.SENDER_COMPANY ||
      '',

    product:
      lead.contact_last_product ||
      lead.QUERY_PRODUCT_NAME ||
      '',

    country:
      lead.country_name ||
      lead.SENDER_COUNTRY ||
      'Unknown',

    mobile:
      lead.contacts_mobile1 ||
      lead.SENDER_MOBILE ||
      '',

    email:
      lead.contacts_email ||
      lead.SENDER_EMAIL ||
      '',

    quantity:
      parseQuantity(lead),

    message:
      lead.last_message ||
      lead.QUERY_MESSAGE ||
      '',

    timestamp:
      lead.contacts_updated_at ||
      new Date().toISOString()
  };
}

async function withRetry(fn, retries = 3) {

  for (let i = 0; i < retries; i++) {

    try {
      return await fn();

    } catch (err) {

      if (err.code === 'SESSION_EXPIRED') {
        throw err;
      }

      if (i === retries - 1) {
        throw err;
      }

      await new Promise(r =>
        setTimeout(r, 2000 * (i + 1))
      );
    }
  }
}

async function fetchLeads(
  cookiesRaw,
  proxyUrl = ''
) {

  const cookieString =
    parseCookies(cookiesRaw);

  if (!cookieString) {
    throw new Error('Invalid cookies');
  }

  return withRetry(async () => {

    const response = await axios.post(

      CONTACT_LIST_URL,

      {
        start: 0,
        limit: 100,
        modid: 'ALL',
        folder: 'ALL',
        flag: 'RECENT'
      },

      {
        headers: {
          ...DEFAULT_HEADERS,
          'Cookie': cookieString,
          'Content-Type':
            'application/json'
        },

        proxy: buildProxy(proxyUrl),

        timeout: 30000
      }
    );

    const data = response.data;

    console.log(
      '[IndiaMART Response]',
      JSON.stringify(data).slice(0, 500)
    );

    if (isSessionExpired(data)) {

      const e = new Error(
        'SESSION_EXPIRED'
      );

      e.code = 'SESSION_EXPIRED';

      throw e;
    }

    const leads =
      data.result ||
      data.response ||
      data.RESPONSE ||
      data.data ||
      data.leads ||
      [];

    if (!Array.isArray(leads)) {

      throw new Error(
        'Lead array not found'
      );
    }

    console.log(
      `Fetched ${leads.length} leads`
    );

    return leads.map(normalizeLead);
  });
}

async function sendMessage(
  cookiesRaw,
  leadId,
  messageText,
  proxyUrl = ''
) {

  const cookieString =
    parseCookies(cookiesRaw);

  if (!cookieString) {
    throw new Error('Invalid cookies');
  }

  return withRetry(async () => {

    const response = await axios.post(

      SEND_MESSAGE_URL,

      {
        I_REQ_ID: leadId,
        msgbody: messageText,
        type: 'QUERY'
      },

      {
        headers: {
          ...DEFAULT_HEADERS,
          'Cookie': cookieString,
          'Content-Type':
            'application/json'
        },

        proxy: buildProxy(proxyUrl),

        timeout: 15000
      }
    );

    const data = response.data;

    console.log(
      '[Send Message]',
      JSON.stringify(data).slice(0, 300)
    );

    if (isSessionExpired(data)) {

      const e = new Error(
        'SESSION_EXPIRED'
      );

      e.code = 'SESSION_EXPIRED';

      throw e;
    }

    if (data.error || data.ERROR) {

      throw new Error(
        data.message ||
        data.MESSAGE ||
        'Message failed'
      );
    }

    return {
      success: true,
      data
    };
  });
}

module.exports = {
  fetchLeads,
  sendMessage,
  parseCookies
};
