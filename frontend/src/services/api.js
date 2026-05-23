const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://indiamart-autopick-1-5ayn.onrender.com'
    : `http://${window.location.hostname}:3001`);

function getHeaders() {
  const token = localStorage.getItem('leadmed_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: getHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Auth ───────────────────────────────────────────────────── */
export const loginUser  = (email, password) => request('POST', '/api/auth/login', { email, password });
export const signupUser = (email, password) => request('POST', '/api/auth/signup', { email, password });
export const getMe      = ()                => request('GET',  '/api/auth/me');

/* ── Admin Management ───────────────────────────────────────── */
export const getAdminUsers      = () => request('GET', '/api/auth/admin/users');
export const togglePremiumUser  = (id) => request('POST', `/api/auth/admin/users/${id}/toggle-premium`);
export const deleteUser         = (id) => request('DELETE', `/api/auth/admin/users/${id}`);
export const createUserAdmin    = (email, password, role, subscription_status) => 
  request('POST', '/api/auth/signup', { email, password, role, subscription_status });

/* ── Subscription ───────────────────────────────────────────── */
export const upgradeSubscription = () => request('POST', '/api/auth/subscription/upgrade');
export const cancelSubscription  = () => request('POST', '/api/auth/subscription/cancel');

/* ── Config ─────────────────────────────────────────────────── */
export const getConfig   = ()       => request('GET',  '/api/config');
export const saveConfig  = (body)   => request('POST', '/api/config', body);

/* ── Cookies ────────────────────────────────────────────────── */
export const uploadCookies = (cookies) => request('POST', '/api/upload-cookies', { cookies });

/* ── Worker ─────────────────────────────────────────────────── */
export const startAutoMode = () => request('POST', '/api/start');
export const stopAutoMode  = () => request('POST', '/api/stop');
export const getStatus     = () => request('GET',  '/api/status');

/* ── Stats ──────────────────────────────────────────────────── */
export const getStats = async () => {
  const data = await request('GET', '/api/stats');
  return { ...(data.stats || {}), topCountries: data.topCountries, topMedicines: data.topMedicines };
};

/* ── Leads ──────────────────────────────────────────────────── */
export const getLeads = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v); });
  return request('GET', `/api/leads?${qs.toString()}`);
};

export const getPriorityLeads = (limit = 20) => request('GET', `/api/leads/priority?limit=${limit}`);

export const acceptLead = (id) => request('POST', `/api/leads/${id}/accept`);
export const skipLead   = (id) => request('POST', `/api/leads/${id}/skip`);
export const tagLead    = (id, tags) => request('POST', `/api/leads/${id}/tag`, { tags });

export const resetCounter   = () => request('POST', '/api/reset-counter');
export const rescoreLeads   = () => request('POST', '/api/leads/rescore');
export const removeDuplicates = () => request('DELETE', '/api/leads/duplicates');

/* ── Export ─────────────────────────────────────────────────── */
export function exportLeads(format = 'csv', status = '', priority = '') {
  const token = localStorage.getItem('leadmed_token');
  const qs = new URLSearchParams({ format });
  if (status)   qs.set('status', status);
  if (priority) qs.set('priority', priority);
  if (token)    qs.set('token', token);
  window.open(`${API_BASE}/api/export?${qs.toString()}`, '_blank');
}

/* ── Logs ───────────────────────────────────────────────────── */
export const getLogs   = (limit = 200) => request('GET', `/api/logs?limit=${limit}`);
export const clearLogs = ()            => request('DELETE', '/api/logs');

/* ── Telegram ───────────────────────────────────────────────── */
export const testTelegram = (token, chat_id) => request('POST', '/api/telegram/test', { token, chat_id });

/* ── Danger ─────────────────────────────────────────────────── */
export const clearLeads = () => request('DELETE', '/api/leads');
