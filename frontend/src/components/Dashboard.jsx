import { useLeadSystem } from '../context/LeadContext';

export default function Dashboard() {
  const { stats, isRunning, sessionExpired, toggleAutoMode, resetLimitCounter } = useLeadSystem();

  const successRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">System Overview</h2>
          <p className="page-subtitle">Real-time lead processing dashboard</p>
        </div>
        <button
          id="auto-mode-toggle"
          className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`}
          onClick={toggleAutoMode}
        >
          {isRunning ? (
            <><span className="pulse-dot"></span> Stop Auto Mode</>
          ) : (
            <><span>▶</span> Start Auto Mode</>
          )}
        </button>
      </div>

      {/* Session expired banner */}
      {sessionExpired && (
        <div className="alert-banner alert-danger">
          ⚠️ <strong>Session Expired!</strong> Please re-upload your IndiaMART cookies and restart.
        </div>
      )}

      {/* Auto mode status banner */}
      {isRunning && !sessionExpired && (
        <div className="alert-banner alert-success">
          <span className="pulse-dot"></span>
          <strong>Auto Mode Active</strong> — Scanning for new leads continuously
        </div>
      )}

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>📥</div>
          <span className="stat-title">Total Leads</span>
          <span className="stat-value total">{stats.total ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✅</div>
          <span className="stat-title">Accepted</span>
          <span className="stat-value accepted">{stats.accepted ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>⏭️</div>
          <span className="stat-title">Skipped</span>
          <span className="stat-value failed">{stats.skipped ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>💬</div>
          <span className="stat-title">Replies Sent</span>
          <span className="stat-value" style={{ color: '#a78bfa' }}>{stats.replied ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🎯</div>
          <span className="stat-title">Accept Limit</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{stats.current || 0} / {stats.limit || 100}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>📊</div>
          <span className="stat-title">Accept Rate</span>
          <span className="stat-value" style={{ color: '#f59e0b' }}>{successRate}%</span>
        </div>
      </div>

      {/* Progress bar (Limit) */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Auto Accept Limit Progress</span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{stats.current || 0} / {stats.limit || 100}</span>
            <button className="btn btn-sm btn-outline" onClick={resetLimitCounter} title="Reset counter to zero">🔄 Reset</button>
          </div>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, (stats.current / (stats.limit || 1)) * 100)}%` }}></div>
        </div>
      </div>

      {/* Progress bar (Total) */}
      {stats.total > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lead Acceptance Progress</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{stats.accepted} / {stats.total}</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${successRate}%` }}></div>
          </div>
        </div>
      )}

      {/* Quick info */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Worker</span>
            <span className={`status-badge ${isRunning ? 'badge-success' : 'badge-muted'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Session</span>
            <span className={`status-badge ${sessionExpired ? 'badge-danger' : 'badge-success'}`}>
              {sessionExpired ? 'Expired' : 'Active'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">SSE Stream</span>
            <span className="status-badge badge-success">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
