import axios from "axios";

const API = "http://localhost:5000";

// ==========================
// LEADS
// ==========================

// Get Leads
export const getLeads = async () => {
  const res = await axios.get(`${API}/leads`);
  return res.data;
};

// Accept Lead
export const acceptLead = async (id) => {
  const res = await axios.post(`${API}/accept`, { id });
  return res.data;
};

// Skip Lead
export const skipLead = async (id) => {
  const res = await axios.post(`${API}/skip`, { id });
  return res.data;
};

// Export Leads
export const exportLeads = async () => {
  const res = await axios.get(`${API}/export`);
  return res.data;
};

// Clear Leads
export const clearLeads = async () => {
  const res = await axios.delete(`${API}/clear`);
  return res.data;
};

// ==========================
// CONFIG
// ==========================

// Get Config
export const getConfig = async () => {
  const res = await axios.get(`${API}/config`);
  return res.data;
};

// Save Config
export const saveConfig = async (data) => {
  const res = await axios.post(`${API}/config`, data);
  return res.data;
};

// Upload Cookies
export const uploadCookies = async (cookies) => {
  const res = await axios.post(`${API}/upload-cookies`, {
    cookies,
  });

  return res.data;
};

// Telegram Test
export const testTelegram = async (data) => {
  const res = await axios.post(`${API}/test-telegram`, data);
  return res.data;
};

// ==========================
// STATS & STATUS
// ==========================

// Get Stats
export const getStats = async () => {
  const res = await axios.get(`${API}/stats`);
  return res.data;
};

// Get Status
export const getStatus = async () => {
  const res = await axios.get(`${API}/status`);
  return res.data;
};

// Start Auto Mode
export const startAutoMode = async () => {
  const res = await axios.post(`${API}/start-auto`);
  return res.data;
};

// Stop Auto Mode
export const stopAutoMode = async () => {
  const res = await axios.post(`${API}/stop-auto`);
  return res.data;
};

// ==========================
// LOGS
// ==========================

// Get Logs
export const getLogs = async () => {
  const res = await axios.get(`${API}/logs`);
  return res.data;
};

// Clear Logs
export const clearLogs = async () => {
  const res = await axios.delete(`${API}/logs`);
  return res.data;
};
