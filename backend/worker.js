const db = require("./db");

const {
  fetchLeads,
} = require("./services/indiamartService");

const {
  sendTelegramNotification,
} = require("./services/telegramService");

let workerTimer = null;
let broadcastFn = null;
let isProcessing = false;

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
// DELAY
// ==========================
function randomDelay(min = 1000, max = 2500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==========================
// MAIN CYCLE (Lead Capture OFF)
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

    log("FETCH", "Fetching leads (Capture Mode: DISABLED)...");

    let leads = [];
    try {
      leads = await fetchLeads(config.cookies, config.proxy_url);
    } catch (err) {
      log("ERROR", err.message);
      isProcessing = false;
      return;
    }

    log("INFO", `Fetched ${leads.length} leads from IndiaMART`);

    // === LEAD CAPTURE DISABLED ===
    // No saving to database
    // No auto reply
    // No Telegram notification

    if (broadcastFn) {
      broadcastFn("leads_fetched", { 
        total: leads.length, 
        note: "Lead capture is disabled" 
      });
    }

    log("INFO", `Cycle completed - ${leads.length} leads seen (Not Saved)`);

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

  log("INFO", `Worker Started (Lead Capture DISABLED)`);

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

module.exports = {
  startWorker,
  stopWorker,
  runCycle
};
