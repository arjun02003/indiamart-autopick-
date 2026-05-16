import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('indiamart_token');
  });
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('indiamart_user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  const signup = async (email, password) => {
    const url = (process.env.NODE_ENV === 'production' ? 'https://indiamart-autopick-1-5ayn.onrender.com' : '') + '/api/auth/signup';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await response.json();
  };

  const login = async (email, password) => {
    const url = (process.env.NODE_ENV === 'production' ? 'https://indiamart-autopick-1-5ayn.onrender.com' : '') + '/api/auth/login';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('indiamart_token', data.token);
      localStorage.setItem('indiamart_user', JSON.stringify(data.user));
      setIsAuthenticated(true);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('indiamart_token');
    localStorage.removeItem('indiamart_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
