import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStats, getStatus, startAutoMode, stopAutoMode } from '../services/api';
import { useAuth } from './AuthContext';

/* ── Safe default — prevents null-destructure crashes on hot-reload ── */
const DEFAULT_LEAD_CTX = {
  stats: { total: 0, accepted: 0, skipped: 0, replied: 0, limit: 100, current: 0, high_priority: 0, avg_score: 0, topCountries: [], topMedicines: [] },
  isRunning: false, sessionExpired: false, notifications: [],
  isDarkMode: true,
  addNotification: () => {}, dismissNotification: () => {},
  toggleAutoMode: () => {}, refreshStats: () => {}, resetLimitCounter: () => {},
  toggleDarkMode: () => {},
};
const LeadContext = createContext(DEFAULT_LEAD_CTX);

export function LeadProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [stats,          setStats]          = useState(DEFAULT_LEAD_CTX.stats);
  const [isRunning,      setIsRunning]      = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [notifications,  setNotifications]  = useState([]);
  const [isDarkMode,     setIsDarkMode]     = useState(() => localStorage.getItem('theme') !== 'light');

  // Refs — avoid stale closures inside SSE listeners
  const sseRef              = useRef(null);
  const notifCounter        = useRef(0);
  const startedThisSession  = useRef(false);  // ref not state — SSE closure reads latest value
  const addNotifRef         = useRef(null);   // stable ref to addNotification

  /* ── Dark mode ─────────────────────────────────────────────────── */
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('light', !next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  /* ── Notifications ─────────────────────────────────────────────── */
  const addNotification = useCallback((type, message) => {
    const id = `n${++notifCounter.current}_${Date.now()}`; // always unique
    setNotifications(p => [...p.slice(-9), { id, type, message }]);
    const dur = type === 'priority' ? 8000 : 5000;
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), dur);
  }, []);
  addNotifRef.current = addNotification; // keep ref in sync

  const dismissNotification = useCallback((id) => {
    setNotifications(p => p.filter(n => n.id !== id));
  }, []);

  /* ── Poll stats / status ────────────────────────────────────────── */
  const refreshStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const s = await getStats();
      setStats(prev => ({ ...prev, ...s }));
    } catch (_) {}
  }, [isAuthenticated]);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const s = await getStatus();
      setIsRunning(s.running);
      // Only surface sessionExpired when worker is actively running
      if (!s.running) setSessionExpired(false);
    } catch (_) {}
  }, [isAuthenticated]);

  /* ── SSE connection ─────────────────────────────────────────────── */
  const connectSSE = useCallback(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

    const token = localStorage.getItem('leadmed_token');
    if (!token) return;

    const base = import.meta.env.PROD
      ? 'https://indiamart-autopick-1-5ayn.onrender.com'
      : `http://${window.location.hostname}:3001`;

    const url = `${base}/api/events?token=${token}`;
    const es = new EventSource(url);

    es.addEventListener('stats', e => {
      try { setStats(prev => ({ ...prev, ...JSON.parse(e.data) })); } catch (_) {}
    });

    es.addEventListener('session_expired', () => {
      setIsRunning(false);
      setSessionExpired(false); // reset — don't persist banner across page loads
      // Only notify if user actively clicked Start this session
      if (startedThisSession.current) {
        setSessionExpired(true);
        addNotifRef.current?.('warning', '🍪 Cookies expired — go to Settings → re-upload cookies');
      }
    });

    es.addEventListener('status_update', e => {
      try {
        const d = JSON.parse(e.data);
        if (d.isRunning !== undefined) setIsRunning(d.isRunning);
      } catch (_) {}
    });

    es.addEventListener('cycle_done', () => refreshStats());

    es.addEventListener('lead_accepted', e => {
      try {
        const lead = JSON.parse(e.data);
        const em = lead.priority === 'High' ? '🔥' : lead.priority === 'Medium' ? '⭐' : '✅';
        addNotifRef.current?.('success', `${em} ${lead.customer_name} — ${(lead.product||'').slice(0,40)} [${lead.ai_score}pts]`);
      } catch (_) {}
    });

    es.addEventListener('priority_lead', e => {
      try {
        const lead = JSON.parse(e.data);
        addNotifRef.current?.('priority', `🔥 HIGH PRIORITY: ${lead.customer_name} from ${lead.country} — Score: ${lead.ai_score}/100`);
      } catch (_) {}
    });

    es.addEventListener('lead_captured', e => {
      try {
        const lead = JSON.parse(e.data);
        addNotifRef.current?.('info', `📥 Extension captured: ${lead.customer_name}`);
      } catch (_) {}
    });

    es.addEventListener('log', e => {
      try {
        const { type, message } = JSON.parse(e.data);
        // Only show error toasts if user started this session AND it's not a session error
        if (type === 'ERROR' && startedThisSession.current && !message.toLowerCase().includes('session')) {
          addNotifRef.current?.('error', message);
        }
      } catch (_) {}
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      if (localStorage.getItem('leadmed_token')) {
        setTimeout(connectSSE, 5000); // reconnect after 5s if still logged in
      }
    };

    sseRef.current = es;
  }, [refreshStats]);

  /* ── Auto mode toggle ───────────────────────────────────────────── */
  const toggleAutoMode = useCallback(async () => {
    try {
      if (isRunning) {
        await stopAutoMode();
        setIsRunning(false);
        setSessionExpired(false);
        startedThisSession.current = false;
      } else {
        const result = await startAutoMode();
        if (result?.success === false) {
          addNotifRef.current?.('warning', `⚙️ ${result.message || 'Upload IndiaMART cookies in Settings first.'}`);
          return;
        }
        setIsRunning(true);
        setSessionExpired(false);
        startedThisSession.current = true;
        addNotifRef.current?.('info', '▶ Auto Mode started — fetching leads…');
      }
    } catch (e) {
      addNotifRef.current?.('error', `Failed to toggle auto mode: ${e.message}`);
    }
  }, [isRunning]);

  const resetLimitCounter = useCallback(async () => {
    try {
      const { resetCounter } = await import('../services/api');
      await resetCounter();
      addNotifRef.current?.('success', '🔄 Counter reset to 0');
      refreshStats();
    } catch (e) {
      addNotifRef.current?.('error', `Reset failed: ${e.message}`);
    }
  }, [refreshStats]);

  /* ── Mount / Authentication connection lifecycle ─────────────────── */
  useEffect(() => {
    if (!isAuthenticated) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setIsRunning(false);
      setSessionExpired(false);
      setStats(DEFAULT_LEAD_CTX.stats);
      return;
    }

    refreshStats();
    refreshStatus();
    connectSSE();

    const t = setInterval(() => { refreshStats(); refreshStatus(); }, 5000);
    return () => {
      clearInterval(t);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [isAuthenticated, refreshStats, refreshStatus, connectSSE]);

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
