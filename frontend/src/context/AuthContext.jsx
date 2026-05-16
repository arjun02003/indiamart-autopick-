import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState({ email: 'admin@system.com' });
  const [loading, setLoading] = useState(false);

  const signup = async () => ({ success: true });
  const login = async () => ({ success: true });
  const logout = () => {
    setIsAuthenticated(false);
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
