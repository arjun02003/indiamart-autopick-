import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Dashboard from "./components/Dashboard";
import Leads from "./components/Leads";
import Settings from "./components/Settings";
import ActivityLog from "./components/ActivityLog";
import Layout from "./components/Layout";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="logs" element={<ActivityLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </HashRouter>
  );
}

export default App;