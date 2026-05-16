import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStats, getStatus, startAutoMode, stopAutoMode } from '../services/api';

const LeadContext = createContext(null);

export function LeadProvider({ children }) {
  const [stats, setStats]           = useState({ total: 0, accepted: 0, skipped: 0, replied: 0, limit: 100, current: 0 });
  const [isRunning, setIsRunning]   = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notifications, setNotifications]   = useState([]);
  const sseRef = useRef(null);

  /* ── Poll stats every 5 s ───────────────────────────────────── */
  const refreshStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch (_) {}
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      setIsRunning(s.running);
      setSessionExpired(s.sessionExpired);
    } catch (_) {}
  }, []);

  /* ── SSE connection ─────────────────────────────────────────── */
  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    const sseUrl = process.env.NODE_ENV === 'production'
      ? '/api/events'
      : `http://${window.location.hostname}:3001/api/events`;
    const es = new EventSource(sseUrl);

    es.addEventListener('stats',           e => setStats(JSON.parse(e.data)));
    es.addEventListener('session_expired', () => { setSessionExpired(true); setIsRunning(false); });
    es.addEventListener('cycle_done',      e => { refreshStats(); });
    es.addEventListener('lead_accepted',   e => {
      const lead = JSON.parse(e.data);
      addNotification('success', `✅ Lead accepted: ${lead.customer_name} — ${lead.product}`);
    });
    es.addEventListener('log', e => {
      const { type, message } = JSON.parse(e.data);
      if (type === 'ERROR') addNotification('error', message);
    });
    es.onerror = () => setTimeout(connectSSE, 5000); // auto-reconnect

    sseRef.current = es;
  }, [refreshStats]);

  /* ── Notifications ──────────────────────────────────────────── */
  const addNotification = useCallback((type, message) => {
    const id = Date.now();
    setNotifications(p => [...p.slice(-9), { id, type, message }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 5000);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(p => p.filter(n => n.id !== id));
  }, []);

  /* ── Auto mode toggle ───────────────────────────────────────── */
  const toggleAutoMode = useCallback(async () => {
    try {
      if (isRunning) { await stopAutoMode(); setIsRunning(false); }
      else           { await startAutoMode(); setIsRunning(true); setSessionExpired(false); }
    } catch (e) {
      addNotification('error', `Failed: ${e.message}`);
    }
  }, [isRunning, addNotification]);

  const resetLimitCounter = useCallback(async () => {
    try {
      const { resetCounter } = await import('../services/api');
      await resetCounter();
      addNotification('success', '🔄 Accepted counter reset to 0');
      refreshStats();
    } catch (e) {
      addNotification('error', `Reset failed: ${e.message}`);
    }
  }, [refreshStats, addNotification]);

  useEffect(() => {
    refreshStats();
    refreshStatus();
    connectSSE();
    const t = setInterval(() => { refreshStats(); refreshStatus(); }, 5000);
    return () => { clearInterval(t); sseRef.current?.close(); };
  }, [refreshStats, refreshStatus, connectSSE]);

  return (
    <LeadContext.Provider value={{
      stats, isRunning, sessionExpired,
      notifications, addNotification, dismissNotification,
      toggleAutoMode, refreshStats, resetLimitCounter
    }}>
      {children}
    </LeadContext.Provider>
  );
}

export const useLeadSystem = () => useContext(LeadContext);
