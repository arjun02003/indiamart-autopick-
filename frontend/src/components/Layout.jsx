import { NavLink, Outlet } from 'react-router-dom';
import { useLeadSystem } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';

export default function Layout() {
  const { isRunning, stats, toggleAutoMode } = useLeadSystem();
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-small">💊</span>
          <h1>IndiaMART</h1>
        </div>

        {/* Worker status pill - Now a clickable toggle */}
        <div 
          className={`worker-pill ${isRunning ? 'running' : 'stopped'}`} 
          onClick={toggleAutoMode}
          title={isRunning ? "Click to Stop Automation" : "Click to Start Automation"}
        >
          {isRunning
            ? <><span className="pulse-dot"></span> Auto Mode ON</>
            : <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b', display: 'inline-block' }}></span> Auto Mode OFF</>
          }
        </div>

        <nav>
          <NavLink to="/"        end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/leads"       className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📋 Leads
            {stats.total > 0 && <span className="nav-badge">{stats.total}</span>}
          </NavLink>
          <NavLink to="/logs"        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📜 Activity Log</NavLink>
          <NavLink to="/settings"    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>⚙️ Settings</NavLink>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <img 
              src={user?.photoURL || 'https://ui-avatars.com/api/?name=' + (user?.displayName || 'User')} 
              alt="Profile" 
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent)' }} 
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button className="btn btn-sm btn-outline" style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }} onClick={logout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <Notifications />
    </div>
  );
}
