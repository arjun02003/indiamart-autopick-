import axios from 'axios';

const BASE = 'http://localhost:3001/api';

const api = axios.create({ baseURL: BASE, timeout: 15000 });

export const getConfig      = ()       => api.get('/config').then(r => r.data.config);
export const saveConfig     = (data)   => api.post('/config', data).then(r => r.data);
export const uploadCookies  = (cookies)=> api.post('/upload-cookies', { cookies }).then(r => r.data);

export const startAutoMode  = ()       => api.post('/start').then(r => r.data);
export const stopAutoMode   = ()       => api.post('/stop').then(r => r.data);
export const getStatus      = ()       => api.get('/status').then(r => r.data);

export const getLeads       = (params) => api.get('/leads', { params }).then(r => r.data);
export const getStats       = ()       => api.get('/stats').then(r => r.data.stats);
export const resetCounter   = ()       => api.post('/reset-counter').then(r => r.data);
export const acceptLead     = (id)     => api.post(`/leads/${id}/accept`).then(r => r.data);
export const skipLead       = (id)     => api.post(`/leads/${id}/skip`).then(r => r.data);
export const clearLeads     = ()       => api.delete('/leads').then(r => r.data);

export const getLogs        = (limit)  => api.get('/logs', { params: { limit } }).then(r => r.data.logs);
export const clearLogs      = ()       => api.delete('/logs').then(r => r.data);

export const exportLeads    = (format, status) => {
  const params = new URLSearchParams({ format, ...(status ? { status } : {}) });
  window.open(`${BASE}/export?${params}`, '_blank');
};

export const testTelegram   = (token, chat_id) => api.post('/telegram/test', { token, chat_id }).then(r => r.data);

export default api;
