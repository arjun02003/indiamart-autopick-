/* ─────────────────────────────────────────────────────────────────────
   LeadMed Chrome Extension — Content Script
   Injects into: https://seller.indiamart.com/*
   Captures lead data from the DOM + API interception
───────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Avoid re-injection
  if (window.__leadmedInjected) return;
  window.__leadmedInjected = true;

  let isCapturing = false;
  let capturedIds = new Set();
  let pollTimer = null;

  /* ── Sidebar panel ─────────────────────────────────────────── */
  function injectSidebar() {
    if (document.getElementById('leadmed-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'leadmed-sidebar';
    sidebar.innerHTML = `
      <div id="leadmed-header">
        <span>💊</span>
        <span style="font-weight:700;font-size:0.9rem;">LeadMed</span>
        <button id="leadmed-minimize" title="Minimize">—</button>
      </div>
      <div id="leadmed-body">
        <div id="leadmed-status" class="lm-status lm-stopped">● Stopped</div>
        <div id="leadmed-count" style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">0 captured</div>
        <button id="leadmed-toggle" class="lm-btn lm-btn-start">▶ Start Capture</button>
        <div id="leadmed-log"></div>
      </div>
    `;
    document.body.appendChild(sidebar);

    // Toggle button
    document.getElementById('leadmed-toggle').addEventListener('click', toggleCapture);

    // Minimize
    let minimized = false;
    document.getElementById('leadmed-minimize').addEventListener('click', () => {
      const body = document.getElementById('leadmed-body');
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'flex';
      document.getElementById('leadmed-minimize').textContent = minimized ? '+' : '—';
      sidebar.style.height = minimized ? '38px' : 'auto';
    });
  }

  function toggleCapture() {
    if (isCapturing) {
      stopCapture();
    } else {
      startCapture();
    }
  }

  function startCapture() {
    isCapturing = true;
    updateSidebarState();
    logMsg('🟢 Capture started');
    scanLeads();
    pollTimer = setInterval(scanLeads, 15000);
    chrome.runtime.sendMessage({ action: 'startCapture' });
  }

  function stopCapture() {
    isCapturing = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    updateSidebarState();
    logMsg('🔴 Capture stopped');
  }

  function updateSidebarState() {
    const statusEl = document.getElementById('leadmed-status');
    const toggleBtn = document.getElementById('leadmed-toggle');
    if (!statusEl || !toggleBtn) return;
    if (isCapturing) {
      statusEl.className = 'lm-status lm-running';
      statusEl.textContent = '● Capturing…';
      toggleBtn.className = 'lm-btn lm-btn-stop';
      toggleBtn.textContent = '■ Stop';
    } else {
      statusEl.className = 'lm-status lm-stopped';
      statusEl.textContent = '● Stopped';
      toggleBtn.className = 'lm-btn lm-btn-start';
      toggleBtn.textContent = '▶ Start Capture';
    }
  }

  function logMsg(msg) {
    const log = document.getElementById('leadmed-log');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'lm-log-entry';
    el.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
    log.insertBefore(el, log.firstChild);
    // Keep last 20 entries
    while (log.children.length > 20) log.removeChild(log.lastChild);
  }

  function updateCount(n) {
    const el = document.getElementById('leadmed-count');
    if (el) el.textContent = `${n} captured`;
  }

  /* ── Lead scanning — fetch from IndiaMART's own API ────────── */
  async function scanLeads() {
    if (!isCapturing) return;
    logMsg('🔄 Scanning leads…');

    try {
      // Use the page's own session cookies (already present in the browser)
      const res = await fetch('https://seller.indiamart.com/lmsreact/getContactList', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://seller.indiamart.com/leadmanager/',
        },
        body: JSON.stringify({ page: 1, limit: 50, modid: 'ALL', folder: 'ALL', flag: 'RECENT' }),
        credentials: 'include', // uses browser's cookies
      });

      if (!res.ok) { logMsg(`⚠️ HTTP ${res.status}`); return; }

      const data = await res.json();
      const leads = data.result || data.RESPONSE || data.response || data.leads || data.data
        || data.Results || data.enquiries || (Array.isArray(data) ? data : []);

      if (!Array.isArray(leads)) { logMsg('⚠️ No leads array in response'); return; }

      let newCount = 0;
      for (const raw of leads) {
        const lead = normalizeLead(raw);
        if (!lead.lead_id || capturedIds.has(lead.lead_id)) continue;
        capturedIds.add(lead.lead_id);
        newCount++;

        // Send to background for API submission
        chrome.runtime.sendMessage({ action: 'leadFromPage', lead });
      }

      if (newCount > 0) {
        logMsg(`✅ ${newCount} new lead(s) sent`);
        updateCount(capturedIds.size);
      } else {
        logMsg(`ℹ️ ${leads.length} leads found, 0 new`);
      }
    } catch (e) {
      logMsg(`❌ Error: ${e.message}`);
    }
  }

  /* ── Normalize a raw IndiaMART lead ────────────────────────── */
  function normalizeLead(lead) {
    const qty = parseQuantity(lead);
    return {
      lead_id      : String(lead.im_contact_id || lead.contacts_glid || lead.I_REQ_ID || lead.QUERY_ID || Math.random().toString(36).slice(2)),
      customer_name: lead.contacts_name  || lead.SENDER_NAME  || lead.NAME || 'Unknown',
      company_name : lead.contacts_company || lead.SENDER_COMPANY || lead.COMP_NAME || '',
      product      : lead.contact_last_product || lead.QUERY_PRODUCT_NAME || lead.PROD_NAME || lead.subject || '',
      country      : lead.country_name   || lead.SENDER_COUNTRY || lead.COUNTRY || 'Unknown',
      mobile       : lead.contacts_mobile1 || lead.SENDER_MOBILE  || lead.MOBILE || '',
      email        : lead.contacts_email   || lead.SENDER_EMAIL   || '',
      quantity     : qty,
      message      : lead.last_message     || lead.QUERY_MSSAGE   || lead.QUERY_MESSAGE || '',
      call_details : lead.call_details     || lead.CALL_DETAIL    || '',
      timestamp    : lead.contacts_updated_at || lead.I_QUERY_TIME || new Date().toISOString(),
    };
  }

  function parseQuantity(lead) {
    const fields = ['last_product_qty','QUERY_PRODUCT_QUANTITY','QUANTITY','quantity','ORDER_QTY','qty'];
    for (const f of fields) {
      if (lead[f] != null && lead[f] !== '') {
        const n = parseFloat(String(lead[f]).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    const text = lead.last_message || lead.QUERY_MSSAGE || '';
    const m = String(text).match(/(\d+(?:\.\d+)?)\s*(?:units?|pcs?|tablets?|bottles?|boxes?|kgs?|grams?|mg|strips?)/i);
    return m ? parseFloat(m[1]) : 0;
  }

  /* ── Listen for messages from popup/background ──────────────── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'startCapture') { startCapture(); sendResponse({ ok: true }); }
    if (msg.action === 'stopCapture')  { stopCapture();  sendResponse({ ok: true }); }
    if (msg.action === 'getStatus')    { sendResponse({ isCapturing, capturedCount: capturedIds.size }); }
    return true;
  });

  /* ── Initialize ─────────────────────────────────────────────── */
  injectSidebar();

  // Check if capture was already running (from popup)
  chrome.storage.local.get(['isCapturing'], (data) => {
    if (data.isCapturing) startCapture();
  });

  console.log('[LeadMed] Content script initialized on', window.location.href);

})();
