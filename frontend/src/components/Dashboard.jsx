import { useLeadSystem } from '../context/LeadContext';

export default function Dashboard() {
  const { stats, isRunning, setIsRunning } = useLeadSystem();

  const toggleWorker = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>System Overview</h2>
        <button 
          className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'}`}
          onClick={toggleWorker}
        >
          {isRunning ? 'Stop Fetching' : 'Start Fetching'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-title">Total Leads Fetched</span>
          <span className="stat-value total">{stats.total}</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Accepted Leads</span>
          <span className="stat-value accepted">{stats.accepted}</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Failed Leads</span>
          <span className="stat-value failed">{stats.failed}</span>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Status Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <span className="stat-title">API Status: </span>
            <span style={{ 
              color: stats.apiMessage?.includes('Error') ? 'var(--danger)' : 
                     stats.apiMessage?.includes('Success') ? 'var(--success)' : 'var(--text-main)' 
            }}>
              {stats.apiMessage || 'Waiting to fetch...'}
            </span>
          </div>
          {stats.lastCheckTime && (
            <div>
              <span className="stat-title">Last Checked: </span>
              <span style={{ color: 'var(--text-main)' }}>{new Date(stats.lastCheckTime).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
