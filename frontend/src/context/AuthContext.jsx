import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, signupUser, getMe } from '../services/api';

const DEFAULT_AUTH = {
  user: null,
  isAuthenticated: false,
  login: () => Promise.resolve(),
  signup: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  updateUser: () => {},
  loading: true
};
const AuthContext = createContext(DEFAULT_AUTH);

const TOKEN_KEY = 'leadmed_token';
const USER_KEY  = 'leadmed_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const res = await getMe();
          if (res && res.success && res.user) {
            setUser(res.user);
            localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          } else {
            // invalid session
            logout();
          }
        } catch (err) {
          console.warn('Session verification failed on start:', err.message);
          // Network error vs token error. If token invalid (401/403), log out:
          if (err.message.includes('401') || err.message.includes('403') || err.message.includes('token') || err.message.includes('expired')) {
            logout();
          } else {
            // Offline or backend offline: load cached user
            const cached = localStorage.getItem(USER_KEY);
            if (cached) {
              try { setUser(JSON.parse(cached)); } catch (_) {}
            }
          }
        }
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const login = async (email, password) => {
    if (!email || !password) throw new Error('Email and password are required');
    const res = await loginUser(email, password);
    if (res && res.success && res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    } else {
      throw new Error(res.error || 'Login failed');
    }
  };

  const signup = async (email, password) => {
    if (!email || !password) throw new Error('Email and password are required');
    const res = await signupUser(email, password);
    if (res && res.success && res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    } else {
      throw new Error(res.error || 'Signup failed');
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    return Promise.resolve();
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, updateUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
