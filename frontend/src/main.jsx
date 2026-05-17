import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { LeadProvider } from './context/LeadContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <LeadProvider>
        <App />
      </LeadProvider>
    </AuthProvider>
  </StrictMode>,
);
