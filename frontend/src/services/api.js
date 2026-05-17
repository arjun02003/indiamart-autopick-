import axios from "axios";

// ==========================
// BASE URL
// ==========================

const BASE =
  process.env.NODE_ENV === "production"
    ? "https://indiamart-autopick-1-5ayn.onrender.com/api"
    : "http://localhost:3001/api";

// ==========================
// AXIOS
// ==========================

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// ==========================
// CONFIG
// ==========================

export const getConfig = async () => {
  const res = await api.get("/config");
  return res.data.config;
};

export const saveConfig = async (data) => {
  const res = await api.post("/config", data);
  return res.data;
};

export const uploadCookies = async (cookies) => {
  const res = await api.post("/upload-cookies", {
    cookies,
  });

  return res.data;
};

// ==========================
// AUTO MODE
// ==========================

export const startAutoMode = async () => {
  const res = await api.post("/start");
  return res.data;
};

export const stopAutoMode = async () => {
  const res = await api.post("/stop");
  return res.data;
};

export const getStatus = async () => {
  const res = await api.get("/status");
  return res.data;
};

// ==========================
// LEADS
// ==========================

export const getLeads = async (params = {}) => {
  const res = await api.get("/leads", {
    params,
  });

  return res.data;
};

export const getStats = async () => {
  const res = await api.get("/stats");
  return res.data.stats;
};

export const resetCounter = async () => {
  const res = await api.post("/reset-counter");
  return res.data;
};

export const acceptLead = async (id) => {
  const res = await api.post(`/leads/${id}/accept`);
  return res.data;
};

export const skipLead = async (id) => {
  const res = await api.post(`/leads/${id}/skip`);
  return res.data;
};

export const clearLeads = async () => {
  const res = await api.delete("/leads");
  return res.data;
};

// ==========================
// LOGS
// ==========================

export const getLogs = async (limit = 100) => {
  const res = await api.get("/logs", {
    params: { limit },
  });

  return res.data.logs;
};

export const clearLogs = async () => {
  const res = await api.delete("/logs");
  return res.data;
};

// ==========================
// EXPORT
// ==========================

export const exportLeads = (format = "json", status = "") => {
  const params = new URLSearchParams({
    format,
    ...(status ? { status } : {}),
  });

  window.open(
    `${BASE}/export?${params}`,
    "_blank"
  );
};

// ==========================
// TELEGRAM
// ==========================

export const testTelegram = async (
  token,
  chat_id
) => {
  const res = await api.post(
    "/telegram/test",
    {
      token,
      chat_id,
    }
  );

  return res.data;
};

export default api;