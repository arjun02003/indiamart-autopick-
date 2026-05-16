import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState({ name: 'Admin' });
  const [loading, setLoading] = useState(false);

  const loginWithGoogle = () => {
    // No action needed
  };

  const logout = () => {
    // No action needed
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
