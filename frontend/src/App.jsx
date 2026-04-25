import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings as SettingsIcon, Activity } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import ActivityLog from './components/ActivityLog';
import { LeadProvider } from './context/LeadContext';

function App() {
  return (
    <LeadProvider>
      <BrowserRouter>
        <div className="app-container">
          <aside className="sidebar glass-panel">
            <h1>IndiaMART System</h1>
            <nav>
              <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <LayoutDashboard size={20} />
                Dashboard
              </NavLink>
              <NavLink to="/logs" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Activity size={20} />
                Activity Log
              </NavLink>
              <NavLink to="/settings" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <SettingsIcon size={20} />
                Settings
              </NavLink>
            </nav>
          </aside>
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/logs" element={<ActivityLog />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </LeadProvider>
  );
}

export default App;
