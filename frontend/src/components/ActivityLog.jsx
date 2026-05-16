import { useState, useEffect, useRef } from 'react';
import { getLogs, clearLogs } from '../services/api';
import { useLeadSystem } from '../context/LeadContext';

const LOG_STYLES = {
  FETCH  : { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: '🔄' },
  ACCEPT : { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  icon: '✅' },
  REPLY  : { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', icon: '💬' },
  SKIP   : { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: '⏭️' },
  INFO   : { color: '#94a3b8', bg: 'rgba(148,163,184,0.05)', icon: 'ℹ️' },
  ERROR  : { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '❌' },
};

export default function ActivityLog() {
  const { addNotification } = useLeadSystem();
  const [logs,       setLogs]       = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter,     setFilter]     = useState('');
  const bottomRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const data = await getLogs(300);
      setLogs(data.reverse()); // newest last for auto-scroll
    } catch (_) {}
  };

  useEffect(() => { fetchLogs(); const t = setInterval(fetchLogs, 4000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const handleClear = async () => {
    if (!window.confirm('Clear all activity logs?')) return;
    try { await clearLogs(); setLogs([]); addNotification('success', 'Logs cleared'); }
    catch (e) { addNotification('error', e.message); }
  };

  const filtered = filter ? logs.filter(l => l.type === filter) : logs;

  return (
    <div className="activity-log">
      <div className="page-header">
        <div>
          <h2 className="page-title">Activity Log</h2>
          <p className="page-subtitle">{logs.length} total events</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Types</option>
            {Object.keys(LOG_STYLES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="toggle-row" style={{ gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Auto-scroll</span>
            <div className={`toggle ${autoScroll ? 'on' : 'off'}`} onClick={() => setAutoScroll(p => !p)} />
          </label>
          <button className="btn btn-outline" onClick={fetchLogs}>🔄</button>
          <button className="btn btn-danger" onClick={handleClear}>🗑️ Clear</button>
        </div>
      </div>

      <div className="glass-panel log-container">
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No log entries yet. Start auto mode to see activity.
          </div>
        ) : (
          filtered.map(log => {
            const style = LOG_STYLES[log.type] || LOG_STYLES.INFO;
            return (
              <div key={log.id} className="log-entry" style={{ borderLeft: `3px solid ${style.color}`, background: style.bg }}>
                <span className="log-icon">{style.icon}</span>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="log-type" style={{ color: style.color }}>[{log.type}]</span>
                <span className="log-msg">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
