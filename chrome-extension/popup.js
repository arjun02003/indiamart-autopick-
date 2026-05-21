/* ─────────────────────────────────────────────────────────────────────
   LeadMed Chrome Extension — Popup Logic
───────────────────────────────────────────────────────────────────── */

const DEFAULT_BACKEND = 'http://localhost:3001';

// DOM refs
const statusDot     = document.getElementById('status-dot');
const statusLabel   = document.getElementById('status-label');
const statusSub     = document.getElementById('status-sub');
const backendDisplay= document.getElementById('backend-url-display');
const statCaptured  = document.getElementById('stat-captured');
const statSent      = document.getElementById('stat-sent');
const statScore     = document.getElementById('stat-score');
const btnCapture    = document.getElementById('btn-capture');
const btnStop       = document.getElementById('btn-stop');
const btnDashboard  = document.getElementById('btn-dashboard');
const backendInput  = document.getElementById('backend-url');
const btnSaveUrl    = document.getElementById('btn-save-url');
const leadList      = document.getElementById('lead-list');
const leadCountLabel= document.getElementById('lead-count-label');
const btnClear      = document.getElementById('btn-clear');

let backendUrl = DEFAULT_BACKEND;
let isCapturing = false;
let recentLeads = [];

/* ── Load stored state ─────────────────────────────────────────── */
async function loadState() {
  const data = await chrome.storage.local.get(['backendUrl', 'isCapturing', 'recentLeads', 'stats']);
  backendUrl = data.backendUrl || DEFAULT_BACKEND;
  isCapturing = data.isCapturing || false;
  recentLeads = data.recentLeads || [];

  backendInput.value = backendUrl;
  backendDisplay.textContent = backendUrl.replace('http://', '').replace('https://', '');

  updateStats(data.stats || {});
  renderLeadList();
  updateControlState();
  checkBackendConnection();
}

/* ── Check backend connection ──────────────────────────────────── */
async function checkBackendConnection() {
  try {
    const res = await fetch(`${backendUrl}/`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      setStatus('connected', '✅ Backend Connected', `${backendUrl.replace('http://', '')}`);
    } else {
      setStatus('disconnected', '⚠️ Backend Error', `HTTP ${res.status}`);
    }
  } catch {
    setStatus('disconnected', '❌ Backend Offline', `Cannot reach ${backendUrl.replace('http://', '')}`);
  }
}

function setStatus(state, label, sub) {
  statusDot.className = `status-dot ${state}`;
  statusLabel.textContent = label;
  statusSub.innerHTML = `Backend: <span id="backend-url-display">${sub}</span>`;
}

/* ── Update stats display ──────────────────────────────────────── */
function updateStats(stats) {
  statCaptured.textContent = stats.captured ?? recentLeads.length ?? 0;
  statSent.textContent     = stats.sent ?? 0;
  statScore.textContent    = stats.avgScore ? Math.round(stats.avgScore) : '—';
}

/* ── Render lead list ──────────────────────────────────────────── */
function renderLeadList() {
  leadCountLabel.textContent = `${recentLeads.length} leads`;
  if (recentLeads.length === 0) {
    leadList.innerHTML = '<div class="empty-state">No leads captured yet.<br/>Navigate to IndiaMART seller panel to start.</div>';
    return;
  }
  leadList.innerHTML = recentLeads.slice(-10).reverse().map(lead => {
    const score = lead.ai_score || 0;
    const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-medium' : 'score-low';
    return `
      <div class="lead-item">
        <div>
          <div class="lead-name">${escHtml(lead.customer_name || 'Unknown')}</div>
          <div class="lead-meta">${escHtml(lead.country || '')} • ${escHtml(lead.product?.slice(0,28) || '')}${(lead.product?.length||0)>28?'…':''}</div>
        </div>
        <span class="lead-score ${scoreClass}">${score}</span>
      </div>
    `;
  }).join('');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Update button states ──────────────────────────────────────── */
function updateControlState() {
  if (isCapturing) {
    btnCapture.disabled = true;
    btnCapture.textContent = '⏳ Capturing…';
    btnStop.disabled = false;
    statusDot.className = 'status-dot capturing';
  } else {
    btnCapture.disabled = false;
    btnCapture.textContent = '▶ Start Capture';
    btnStop.disabled = true;
  }
}

/* ── Start capture ─────────────────────────────────────────────── */
btnCapture.addEventListener('click', async () => {
  isCapturing = true;
  await chrome.storage.local.set({ isCapturing: true });
  updateControlState();

  // Send message to background to start capturing
  chrome.runtime.sendMessage({ action: 'startCapture', backendUrl });

  // Also inject content script into active IndiaMART tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('seller.indiamart.com')) {
    chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
    setStatus('capturing', '🔄 Capturing Leads…', 'Running on IndiaMART');
  } else {
    setStatus('disconnected', '⚠️ Open IndiaMART', 'Navigate to seller.indiamart.com');
  }
});

/* ── Stop capture ──────────────────────────────────────────────── */
btnStop.addEventListener('click', async () => {
  isCapturing = false;
  await chrome.storage.local.set({ isCapturing: false });
  chrome.runtime.sendMessage({ action: 'stopCapture' });
  updateControlState();
  checkBackendConnection();
});

/* ── Open dashboard ────────────────────────────────────────────── */
btnDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: `${backendUrl}` });
});

/* ── Save backend URL ──────────────────────────────────────────── */
btnSaveUrl.addEventListener('click', async () => {
  const newUrl = backendInput.value.trim().replace(/\/$/, '');
  if (!newUrl) return;
  backendUrl = newUrl;
  await chrome.storage.local.set({ backendUrl: newUrl });
  backendDisplay.textContent = newUrl.replace('http://', '').replace('https://', '');
  btnSaveUrl.textContent = '✓';
  setTimeout(() => { btnSaveUrl.textContent = 'Save'; }, 1500);
  checkBackendConnection();
});

/* ── Clear local leads ─────────────────────────────────────────── */
btnClear.addEventListener('click', async () => {
  recentLeads = [];
  await chrome.storage.local.set({ recentLeads: [], stats: {} });
  renderLeadList();
  updateStats({});
});

/* ── Listen for messages from background ───────────────────────── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'leadCaptured') {
    recentLeads.push(msg.lead);
    chrome.storage.local.set({ recentLeads });
    renderLeadList();
    const captured = recentLeads.length;
    const avgScore = Math.round(recentLeads.reduce((a, l) => a + (l.ai_score || 0), 0) / captured);
    updateStats({ captured, avgScore, sent: msg.totalSent || 0 });
  }
  if (msg.action === 'connectionStatus') {
    if (msg.connected) {
      setStatus('connected', '✅ Backend Connected', backendUrl.replace('http://', ''));
    } else {
      setStatus('disconnected', '❌ Backend Offline', backendUrl.replace('http://', ''));
    }
  }
});

// Init
loadState();
