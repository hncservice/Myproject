// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const TOKEN_KEY = 'token';
const ROLE_KEY = 'role';
const PROFILE_KEY = 'profile';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [role, setRole] = useState(localStorage.getItem(ROLE_KEY) || null);
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  }, [role]);

  useEffect(() => {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  }, [profile]);

  const login = (roleValue, tokenValue, profileValue) => {
    setRole(roleValue);
    setToken(tokenValue);
    setProfile(profileValue);
  };

  const logout = () => {
    // ✅ clear localStorage using your real keys
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PROFILE_KEY);

    // ✅ clear state
    setToken(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        profile,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
