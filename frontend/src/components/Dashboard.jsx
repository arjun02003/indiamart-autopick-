import { useLeadSystem } from '../context/LeadContext';

export default function Dashboard() {
  const { stats, isRunning, sessionExpired, toggleAutoMode, resetLimitCounter, isDarkMode, toggleDarkMode } = useLeadSystem();

  const successRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
  const topCountries = stats.topCountries || [];
  const topMedicines = stats.topMedicines || [];
  const maxCountryCount = topCountries.length > 0 ? Math.max(...topCountries.map(c => c.count)) : 1;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">System Overview</h2>
          <p className="page-subtitle">Real-time lead processing dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            id="dark-mode-toggle"
            className="btn btn-outline btn-sm"
            onClick={toggleDarkMode}
            title="Toggle dark/light mode"
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
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
      </div>

      {/* Session expired banner — only shown after user actively tried to start */}
      {sessionExpired && (
        <div className="alert-banner alert-danger-flash" style={{ cursor: 'pointer' }} onClick={() => window.location.hash = '#/settings'}>
          🍪 <strong>Cookies expired</strong> — Go to <u>Settings</u> and re-upload your IndiaMART cookies to continue.
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
        <div className="glass-panel stat-card" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🔥</div>
          <span className="stat-title">High Priority</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{stats.high_priority ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>🤖</div>
          <span className="stat-title">Avg AI Score</span>
          <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.avg_score ?? 0}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🎯</div>
          <span className="stat-title">Accept Limit</span>
          <span className="stat-value" style={{ color: '#ef4444', fontSize: '1.6rem' }}>{stats.current || 0} / {stats.limit || 100}</span>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>📊</div>
          <span className="stat-title">Accept Rate</span>
          <span className="stat-value" style={{ color: '#f59e0b' }}>{successRate}%</span>
        </div>
      </div>

      {/* Progress bars row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Accept Limit Progress</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{stats.current || 0} / {stats.limit || 100}</span>
              <button className="btn btn-sm btn-outline" onClick={resetLimitCounter} title="Reset counter">🔄</button>
            </div>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${Math.min(100, (stats.current / (stats.limit || 1)) * 100)}%` }}></div>
          </div>
        </div>
        {stats.total > 0 && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lead Acceptance Rate</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{stats.accepted} / {stats.total}</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${successRate}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics row: Top Countries + Top Medicines */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Top Countries */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>🌍 Top Lead Countries</h3>
          {topCountries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
          ) : topCountries.map(c => (
            <div key={c.country} style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem' }}>{c.country}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.count}</span>
              </div>
              <div className="progress-bar-bg" style={{ height: '6px' }}>
                <div className="progress-bar-fill" style={{ width: `${(c.count / maxCountryCount) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Medicines */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>💊 Top Medicine Keywords</h3>
          {topMedicines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topMedicines.map((m, i) => (
                <span key={m.medicine_name} style={{
                  padding: '0.3rem 0.75rem', borderRadius: '9999px',
                  background: `rgba(139,92,246,${0.3 - i * 0.04})`,
                  border: '1px solid rgba(139,92,246,0.4)',
                  fontSize: `${0.85 - i * 0.04}rem`, color: '#c4b5fd',
                  fontWeight: 600,
                }}>
                  {m.medicine_name} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({m.count})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
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
          <div className="status-item">
            <span className="status-label">AI Scoring</span>
            <span className="status-badge badge-success">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
