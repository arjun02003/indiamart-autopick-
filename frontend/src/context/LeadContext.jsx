import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStats, getStatus, startAutoMode, stopAutoMode } from '../services/api';

const LeadContext = createContext(null);

export function LeadProvider({ children }) {
  const [stats, setStats]           = useState({ total: 0, accepted: 0, skipped: 0, replied: 0, limit: 100, current: 0, high_priority: 0, avg_score: 0, topCountries: [], topMedicines: [] });
  const [isRunning, setIsRunning]   = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notifications, setNotifications]   = useState([]);
  const [startedThisSession, setStartedThisSession] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });
  const sseRef = useRef(null);

  /* ── Dark mode ──────────────────────────────────────────────── */
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('light', !next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isDarkMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isDarkMode]);

  /* ── Poll stats every 5 s ───────────────────────────────────── */
  const refreshStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(prev => ({ ...prev, ...s }));
    } catch (_) {}
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      setIsRunning(s.running);
      // Only show session expired if the worker is/was actively running
      if (!s.running) setSessionExpired(false);
      else setSessionExpired(s.sessionExpired);
    } catch (_) {}
  }, []);

  /* ── SSE connection ─────────────────────────────────────────── */
  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    const sseUrl = import.meta.env.PROD
      ? 'https://indiamart-autopick-1-5ayn.onrender.com/api/events'
      : `http://${window.location.hostname}:3001/api/events`;
    const es = new EventSource(sseUrl);

    es.addEventListener('stats',           e => setStats(prev => ({ ...prev, ...JSON.parse(e.data) })));
    es.addEventListener('session_expired', () => {
      // Only show banner if user started worker this session
      if (startedThisSession) setSessionExpired(true);
      setIsRunning(false);
      addNotification('error', '⚠️ Session expired — please re-upload your IndiaMART cookies in Settings');
    });
    es.addEventListener('status_update',   e => {
      const d = JSON.parse(e.data);
      if (d.isRunning !== undefined) setIsRunning(d.isRunning);
    });
    es.addEventListener('cycle_done', () => { refreshStats(); });
    es.addEventListener('lead_accepted', e => {
      const lead = JSON.parse(e.data);
      const priorityEmoji = lead.priority === 'High' ? '🔥' : lead.priority === 'Medium' ? '⭐' : '';
      addNotification('success', `${priorityEmoji} Lead accepted: ${lead.customer_name} — ${lead.product} [Score: ${lead.ai_score}]`);
    });
    es.addEventListener('priority_lead', e => {
      const lead = JSON.parse(e.data);
      addNotification('priority', `🔥 HIGH PRIORITY LEAD! ${lead.customer_name} from ${lead.country} — Score: ${lead.ai_score}/100`);
    });
    es.addEventListener('lead_captured', e => {
      const lead = JSON.parse(e.data);
      addNotification('info', `📥 Lead captured via Extension: ${lead.customer_name}`);
    });
    es.addEventListener('log', e => {
      const { type, message } = JSON.parse(e.data);
      if (type === 'ERROR') addNotification('error', message);
    });
    es.onerror = () => setTimeout(connectSSE, 5000);

    sseRef.current = es;
  }, [refreshStats]);

  /* ── Notifications ──────────────────────────────────────────── */
  const addNotification = useCallback((type, message) => {
    const id = Date.now();
    setNotifications(p => [...p.slice(-9), { id, type, message }]);
    const duration = type === 'priority' ? 8000 : 5000;
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), duration);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(p => p.filter(n => n.id !== id));
  }, []);

  /* ── Auto mode toggle ───────────────────────────────────────── */
  const toggleAutoMode = useCallback(async () => {
    try {
      if (isRunning) {
        await stopAutoMode();
        setIsRunning(false);
        setSessionExpired(false);
        setStartedThisSession(false);
      } else {
        await startAutoMode();
        setIsRunning(true);
        setSessionExpired(false);
        setStartedThisSession(true); // mark that user started this session
      }
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
      toggleAutoMode, refreshStats, resetLimitCounter,
      isDarkMode, toggleDarkMode,
    }}>
      {children}
    </LeadContext.Provider>
  );
}

export const useLeadSystem = () => useContext(LeadContext);
