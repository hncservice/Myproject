import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [role, setRole] = useState(localStorage.getItem('role') || null); // 'user' | 'vendor' | 'admin'
  const [profile, setProfile] = useState(
    JSON.parse(localStorage.getItem('profile') || 'null')
  );

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem('role', role);
    else localStorage.removeItem('role');
  }, [role]);

  useEffect(() => {
    if (profile) localStorage.setItem('profile', JSON.stringify(profile));
    else localStorage.removeItem('profile');
  }, [profile]);

  const login = (roleValue, tokenValue, profileValue) => {
    setRole(roleValue);
    setToken(tokenValue);
    setProfile(profileValue);
  };

  const logout = () => {
    setRole(null);
    setToken(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, profile, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
