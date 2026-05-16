import { NavLink, Outlet } from 'react-router-dom';
import { useLeadSystem } from '../context/LeadContext';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';

export default function Layout() {
  const { isRunning, stats } = useLeadSystem();
  const { logout } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-small">💊</span>
          <h1>IndiaMART</h1>
        </div>

        {/* Worker status pill */}
        <div className={`worker-pill ${isRunning ? 'running' : 'stopped'}`}>
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

        <button className="nav-link logout-btn" onClick={logout}>🚪 Logout</button>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <Notifications />
    </div>
  );
}
