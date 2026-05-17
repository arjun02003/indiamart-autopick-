const db = require("./db");

const {
  fetchLeads,
  sendMessage
} = require("./services/indiamartService");

const {
  sendTelegramNotification,
} = require("./services/telegramService");

let workerTimer = null;
let broadcastFn = null;
let isProcessing = false;
let sessionExpiredState = false;

// ==========================
// LOG
// ==========================
function log(type, message) {
  const timestamp = new Date().toISOString();
  
  console.log(`[${type.toUpperCase()}] ${message}`);

  if (broadcastFn) {
    broadcastFn("log", { type, message, timestamp });
  }
}

// ==========================
// MAIN CYCLE (Lead Capture ENABLED)
// ==========================
async function runCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const config = db.prepare("SELECT * FROM config WHERE id = 1").get();

    if (!config || config.is_running !== 1) {
      isProcessing = false;
      return;
    }

    log("FETCH", "Fetching leads from IndiaMART...");

    let leads = [];
    try {
      leads = await fetchLeads(config.cookies, config.proxy_url);
      sessionExpiredState = false; // Reset if successful
    } catch (err) {
      if (err.code === 'SESSION_EXPIRED') {
        sessionExpiredState = true;
        log("ERROR", "Session expired. Please update cookies.");
      } else {
        log("ERROR", `Fetch failed: ${err.message}`);
      }
      isProcessing = false;
      return;
    }

    log("INFO", `Fetched ${leads.length} leads from IndiaMART`);

    const keywords = JSON.parse(config.keywords || '[]');
    const countries = JSON.parse(config.countries || '[]');
    const minQuantity = config.min_quantity || 0;
    const replyEnabled = config.reply_enabled === 1;
    let acceptLimit = config.accept_limit || 100;
    let currentAcceptedCount = config.current_accepted_count || 0;

    let newAccepted = 0;
    let newRejected = 0;
    let duplicate = 0;

    for (const lead of leads) {
      // Check if lead exists in database
      const exists = db.prepare("SELECT lead_id FROM leads WHERE lead_id = ?").get(lead.lead_id);
      if (exists) {
        duplicate++;
        continue;
      }

      let status = 'Accepted';
      let reason = '';

      // Check keywords
      if (keywords.length > 0) {
        const pLower = lead.product.toLowerCase();
        const mLower = lead.message.toLowerCase();
        const matchKw = keywords.some(kw => {
          const kLower = kw.toLowerCase();
          return pLower.includes(kLower) || mLower.includes(kLower);
        });
        if (!matchKw) {
          status = 'Rejected';
          reason = 'Keyword mismatch';
        }
      }

      // Check countries
      if (status === 'Accepted' && countries.length > 0) {
        const cLower = lead.country.toLowerCase();
        const matchCountry = countries.some(c => cLower.includes(c.toLowerCase()));
        if (!matchCountry) {
          status = 'Rejected';
          reason = 'Country mismatch';
        }
      }

      // Check quantity
      if (status === 'Accepted' && minQuantity > 0) {
        if (lead.quantity < minQuantity) {
          status = 'Rejected';
          reason = `Quantity < ${minQuantity}`;
        }
      }

      // Check accept limit
      if (status === 'Accepted') {
        if (currentAcceptedCount >= acceptLimit) {
          status = 'Rejected';
          reason = 'Accept limit reached';
        }
      }

      // Insert into leads table
      db.prepare(`
        INSERT INTO leads (lead_id, customer_name, company_name, product, country, mobile, email, quantity, message, timestamp, status, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        lead.lead_id, lead.customer_name, lead.company_name, lead.product,
        lead.country, lead.mobile, lead.email, lead.quantity, lead.message,
        lead.timestamp, status, reason
      );

      if (status === 'Accepted') {
        newAccepted++;
        currentAcceptedCount++;
        
        // Update current accepted count in config
        db.prepare("UPDATE config SET current_accepted_count = ? WHERE id = 1").run(currentAcceptedCount);

        // Auto-reply
        if (replyEnabled && config.auto_reply_msg) {
          const replyText = config.auto_reply_msg.replace(/{product}/gi, lead.product || 'your product');
          try {
            await sendMessage(config.cookies, lead.lead_id, replyText, config.proxy_url);
            db.prepare("UPDATE leads SET replied = 1 WHERE lead_id = ?").run(lead.lead_id);
            log("INFO", `Auto-replied to lead ${lead.lead_id}`);
          } catch (err) {
            log("ERROR", `Auto-reply failed for ${lead.lead_id}: ${err.message}`);
          }
        }

        // Telegram Notification
        if (config.telegram_token && config.telegram_chat_id) {
          const tMsg = `<b>✅ New Lead Accepted</b>\n\n<b>Name:</b> ${lead.customer_name}\n<b>Company:</b> ${lead.company_name}\n<b>Product:</b> ${lead.product}\n<b>Quantity:</b> ${lead.quantity}\n<b>Country:</b> ${lead.country}`;
          await sendTelegramNotification(config.telegram_token, config.telegram_chat_id, tMsg);
        }
      } else {
        newRejected++;
      }
    }

    if (broadcastFn) {
      broadcastFn("leads_fetched", { 
        total: leads.length,
        accepted: newAccepted,
        rejected: newRejected,
        duplicate: duplicate
      });
    }

    log("INFO", `Cycle completed - ${leads.length} fetched | ${newAccepted} Accepted | ${newRejected} Rejected | ${duplicate} Duplicates`);

  } catch (err) {
    log("ERROR", err.message);
  } finally {
    isProcessing = false;
  }
}

// ==========================
// START / STOP WORKER
// ==========================
function startWorker(broadcast) {
  if (workerTimer) return;

  if (broadcast) broadcastFn = broadcast;

  const config = db.prepare("SELECT interval FROM config WHERE id = 1").get();
  const interval = Math.max(15, config?.interval || 30) * 1000;

  log("INFO", `Worker Started with ${interval / 1000}s interval`);

  runCycle();                    // First run
  workerTimer = setInterval(runCycle, interval);
}

function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    log("INFO", "Worker Stopped");
  }
}

function isWorkerRunning() {
  return workerTimer !== null;
}

function isSessionExpiredState() {
  return sessionExpiredState;
}

module.exports = {
  startWorker,
  stopWorker,
  runCycle,
  isWorkerRunning,
  isSessionExpiredState
};