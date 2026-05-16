import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard   from './components/Dashboard';
import Leads       from './components/Leads';
import Settings    from './components/Settings';
import ActivityLog from './components/ActivityLog';
import Login       from './components/Login';
import Layout      from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { LeadProvider } from './context/LeadContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <LeadProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index       element={<Dashboard />} />
              <Route path="leads"    element={<Leads />} />
              <Route path="logs"     element={<ActivityLog />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </LeadProvider>
    </AuthProvider>
  );
}

export default App;
