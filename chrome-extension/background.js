/* ─────────────────────────────────────────────────────────────────────
   LeadMed Chrome Extension — Background Service Worker
   Handles: cookie extraction, lead batching, API communication
───────────────────────────────────────────────────────────────────── */

const DEFAULT_BACKEND = 'http://localhost:3001';
let isCapturing = false;
let backendUrl  = DEFAULT_BACKEND;
let captureInterval = null;
let totalSent = 0;
let pendingLeads = [];

/* ── Init: restore state ───────────────────────────────────────── */
chrome.storage.local.get(['backendUrl', 'isCapturing', 'totalSent'], (data) => {
  backendUrl  = data.backendUrl  || DEFAULT_BACKEND;
  totalSent   = data.totalSent   || 0;
  if (data.isCapturing) startCapture();
});

/* ── Message handler ───────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCapture') {
    backendUrl = msg.backendUrl || backendUrl;
    startCapture();
    sendResponse({ ok: true });
  }

  if (msg.action === 'stopCapture') {
    stopCapture();
    sendResponse({ ok: true });
  }

  if (msg.action === 'leadFromPage') {
    // Lead captured by content script
    processCapturedLead(msg.lead, sender.tab?.id);
    sendResponse({ ok: true });
  }

  if (msg.action === 'cookiesFromPage') {
    // Cookies extracted by content script
    uploadCookiesToBackend(msg.cookies);
    sendResponse({ ok: true });
  }

  if (msg.action === 'getStatus') {
    sendResponse({ isCapturing, backendUrl, totalSent });
  }

  return true; // keep async
});

/* ── Start capture ─────────────────────────────────────────────── */
function startCapture() {
  if (isCapturing) return;
  isCapturing = true;
  chrome.storage.local.set({ isCapturing: true });

  // Auto-extract cookies from IndiaMART tabs
  extractAndUploadCookies();

  // Trigger content script in all IndiaMART tabs
  injectIntoIndiamartTabs();

  // Poll every 30s
  captureInterval = setInterval(() => {
    injectIntoIndiamartTabs();
  }, 30000);

  console.log('[LeadMed BG] Capture started');
}

/* ── Stop capture ──────────────────────────────────────────────── */
function stopCapture() {
  isCapturing = false;
  chrome.storage.local.set({ isCapturing: false });
  if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
  console.log('[LeadMed BG] Capture stopped');
}

/* ── Inject content script into all IndiaMART tabs ─────────────── */
async function injectIntoIndiamartTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
      } catch {
        // Content script not yet loaded — inject it
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          await chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
        } catch (e) {
          console.warn('[LeadMed BG] Cannot inject into tab', tab.id, e.message);
        }
      }
    }
  } catch (e) {
    console.error('[LeadMed BG] injectIntoIndiamartTabs error:', e);
  }
}

/* ── Extract cookies from IndiaMART and upload to backend ───────── */
async function extractAndUploadCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.indiamart.com' });
    if (!cookies || cookies.length === 0) return;

    const cookieArr = cookies.map(c => ({ name: c.name, value: c.value }));
    await uploadCookiesToBackend(cookieArr);
    console.log('[LeadMed BG] Cookies uploaded:', cookieArr.length, 'cookies');
  } catch (e) {
    console.error('[LeadMed BG] Cookie extraction error:', e);
  }
}

async function uploadCookiesToBackend(cookies) {
  try {
    await fetch(`${backendUrl}/api/login-cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies }),
    });
    console.log('[LeadMed BG] Cookies sent to backend');
  } catch (e) {
    console.warn('[LeadMed BG] Failed to upload cookies:', e.message);
  }
}

/* ── Process a captured lead ────────────────────────────────────── */
async function processCapturedLead(lead, tabId) {
  if (!lead || !lead.lead_id) return;

  // Send to backend
  try {
    const res = await fetch(`${backendUrl}/api/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    const data = await res.json();

    if (data.success) {
      totalSent++;
      chrome.storage.local.set({ totalSent });

      const enrichedLead = { ...lead, ai_score: data.ai_score || 0, priority: data.priority || 'Low' };

      // Notify popup
      chrome.runtime.sendMessage({
        action: 'leadCaptured',
        lead: enrichedLead,
        totalSent,
      }).catch(() => {}); // popup may not be open

      // Show browser notification for high-priority leads
      if (data.priority === 'High') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '🔥 High Priority Lead!',
          message: `${lead.customer_name} from ${lead.country} — Score: ${data.ai_score}/100`,
          priority: 2,
        });
      }

      console.log(`[LeadMed BG] Lead sent: ${lead.customer_name} [Score:${data.ai_score}]`);
    }
  } catch (e) {
    console.error('[LeadMed BG] Failed to send lead:', e.message);
    // Store locally for retry
    pendingLeads.push(lead);
    chrome.storage.local.set({ pendingLeads });
  }

  // Retry pending leads
  if (pendingLeads.length > 0) retryPendingLeads();
}

/* ── Retry failed leads ─────────────────────────────────────────── */
async function retryPendingLeads() {
  const toRetry = [...pendingLeads];
  pendingLeads = [];

  for (const lead of toRetry) {
    try {
      const res = await fetch(`${backendUrl}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      if (!res.ok) pendingLeads.push(lead); // still failing, keep
    } catch {
      pendingLeads.push(lead);
    }
  }

  chrome.storage.local.set({ pendingLeads });
}

/* ── On tab navigation to IndiaMART — auto-extract cookies ─────── */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('seller.indiamart.com')) {
    if (isCapturing) {
      extractAndUploadCookies();
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'startCapture' }).catch(() => {});
      }, 2000);
    }
  }
});

/* ── Periodic cookie refresh ────────────────────────────────────── */
setInterval(() => {
  if (isCapturing) extractAndUploadCookies();
}, 5 * 60 * 1000); // every 5 minutes
