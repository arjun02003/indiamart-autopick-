const db = require('./db');
const axios = require('axios');

let workerInterval = null;

function logActivity(type, message) {
  db.prepare('INSERT INTO logs (timestamp, message, type) VALUES (?, ?, ?)').run(
    new Date().toISOString(), message, type
  );
  console.log(`[${type}] ${message}`);
}

function processCookies(cookiesRaw) {
  try {
    const cookies = JSON.parse(cookiesRaw);
    if (Array.isArray(cookies)) {
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } else if (typeof cookies === 'object') {
      return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
    }
    return cookiesRaw; // Maybe it's a string
  } catch(e) {
    return '';
  }
}

async function fetchLeads() {
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  if (config.is_running === 0) return;

  logActivity('FETCH', 'Starting lead fetch cycle...');
  
  const keywords = JSON.parse(config.keywords).map(k => k.toLowerCase());
  const countries = JSON.parse(config.countries).map(c => c.toLowerCase());
  const cookieString = processCookies(config.cookies);
  
  if (!cookieString) {
    logActivity('ERROR', 'No cookies provided, skipping fetch.');
    return;
  }

  try {
    const response = await axios.post('https://seller.indiamart.com/lmsreact/getContactList', {}, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    
    // Assuming response format has leads in data.leads or similar. We will guess data.response or data
    const leads = data.RESPONSE || data.leads || data.data || (Array.isArray(data) ? data : []);
    
    if (!Array.isArray(leads) || leads.length === 0) {
      logActivity('INFO', 'No new leads found or invalid response format.');
      return;
    }

    logActivity('INFO', `Fetched ${leads.length} leads. Processing...`);

    let processedCount = 0;
    
    for (const lead of leads) {
      // Find the fields based on common IndiaMART properties or fallbacks
      const id = lead.I_REQ_ID || lead.QUERY_ID || lead.id || Math.random().toString(36).substring(7);
      const customerName = lead.SENDER_NAME || lead.sender_name || lead.name || 'Unknown';
      const companyName = lead.SENDER_COMPANY || lead.company_name || lead.company || 'Unknown';
      const product = lead.QUERY_PRODUCT_NAME || lead.subject || lead.product || '';
      const country = lead.SENDER_COUNTRY || lead.sender_country || lead.country || 'Unknown';
      const contactDetails = lead.SENDER_EMAIL || lead.SENDER_MOBILE || lead.email || lead.phone || 'Unknown';
      const timestamp = new Date().toISOString();

      // Check if lead already exists
      const existing = db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(id.toString());
      if (existing) continue;

      processedCount++;

      // Evaluate conditions
      let productMatch = keywords.length === 0; // If no keywords, pass product check
      for (const kw of keywords) {
        if (product.toLowerCase().includes(kw)) {
          productMatch = true;
          break;
        }
      }

      let countryMatch = countries.length === 0; // If no countries selected, pass country check
      // Also handle simple aliases
      const lowerCountry = country.toLowerCase();
      const countryAliases = {
        'united states': 'usa',
        'united kingdom': 'uk',
        'uae': 'united arab emirates'
      };
      
      const normalizedCountry = countryAliases[lowerCountry] || lowerCountry;

      for (const c of countries) {
        if (normalizedCountry.includes(c) || lowerCountry.includes(c)) {
          countryMatch = true;
          break;
        }
      }

      const isAccepted = productMatch && countryMatch;
      const status = isAccepted ? 'Accepted' : 'Failed';
      let reason = '';
      if (!isAccepted) {
        if (!productMatch && !countryMatch) reason = 'Product & Country mismatch';
        else if (!productMatch) reason = 'Product mismatch';
        else if (!countryMatch) reason = 'Country mismatch';
      } else {
        reason = 'Matched';
      }

      db.prepare(`
        INSERT INTO leads (lead_id, customer_name, company_name, product, country, contact_details, timestamp, status, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id.toString(), customerName, companyName, product, country, contactDetails, timestamp, status, reason);
    }
    
    logActivity('INFO', `Processed ${processedCount} new leads.`);

  } catch (error) {
    logActivity('ERROR', `Fetch failed: ${error.message}`);
  }
}

function startWorker() {
  if (workerInterval) return;
  const config = db.prepare('SELECT interval FROM config WHERE id = 1').get();
  const intervalMs = Math.max(10, config.interval) * 1000;
  
  logActivity('INFO', `Worker started with interval ${intervalMs / 1000}s`);
  fetchLeads(); // Run immediately
  workerInterval = setInterval(fetchLeads, intervalMs);
}

function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logActivity('INFO', 'Worker stopped.');
  }
}

function isWorkerRunning() {
  return workerInterval !== null;
}

module.exports = { startWorker, stopWorker, isWorkerRunning };
