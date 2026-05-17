import axios from "axios";

const API = "http://localhost:5000";

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

// Clear Leads
export const clearLeads = async () => {
  const res = await axios.delete(`${API}/clear`);
  return res.data;
};
