import { NavLink, Outlet } from 'react-router-dom';
import { useLeadSystem } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';

export default function Layout() {
  const { isRunning, stats, toggleAutoMode, isDarkMode, toggleDarkMode } = useLeadSystem();
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-small">💊</span>
          <div>
            <h1>LeadMed</h1>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '-2px' }}>IndiaMART Pro</div>
          </div>
        </div>

        {/* Worker status pill */}
        <div
          className={`worker-pill ${isRunning ? 'running' : 'stopped'}`}
          onClick={toggleAutoMode}
          title={isRunning ? 'Click to Stop Automation' : 'Click to Start Automation'}
        >
          {isRunning
            ? <><span className="pulse-dot"></span> Auto Mode ON</>
            : <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b', display: 'inline-block' }}></span> Auto Mode OFF</>
          }
        </div>

        <nav>
          <NavLink to="/"        end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink to="/leads"       className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📋</span> Leads
            {stats.total > 0 && <span className="nav-badge">{stats.total}</span>}
          </NavLink>
          {stats.high_priority > 0 && (
            <NavLink to="/leads?priority=High" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ color: '#ef4444' }}>
              <span>🔥</span> Priority
              <span className="nav-badge" style={{ background: '#ef4444' }}>{stats.high_priority}</span>
            </NavLink>
          )}
          <NavLink to="/logs"        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📜</span> Activity Log
          </NavLink>
          <NavLink to="/settings"    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>⚙️</span> Settings
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Dark mode toggle */}
          <button
            className="btn btn-outline btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={toggleDarkMode}
            title="Toggle dark/light mode"
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          {/* User info */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=6366f1&color=fff`}
                alt="Profile"
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent)' }}
              />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.displayName || 'Admin'}
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
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <Notifications />
    </div>
  );
}
