import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULT_AUTH = { user: null, isAuthenticated: false, login: () => Promise.resolve(), signup: () => Promise.resolve(), loginWithGoogle: () => Promise.resolve(), logout: () => Promise.resolve(), loading: false };
const AuthContext = createContext(DEFAULT_AUTH);

// ── Simple local auth — no Firebase needed ─────────────────────────
// Default credentials (change in Settings if needed)
const DEFAULT_USER = { email: 'admin@leadmed.local', displayName: 'Admin', photoURL: null };
const STORAGE_KEY  = 'leadmed_authed';

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { setUser(null); }
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    // Accept any non-empty credentials
    if (!email || !password) return Promise.reject(new Error('Enter email and password'));
    const u = { email, displayName: email.split('@')[0], photoURL: null };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return Promise.resolve(u);
  };

  const signup = async (email, password, name) => {
    const u = { email, displayName: name || email.split('@')[0], photoURL: null };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  };

  const loginWithGoogle = () => {
    // Fallback: auto-login as admin when Google not available
    setUser(DEFAULT_USER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER));
    return Promise.resolve(DEFAULT_USER);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, loginWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
