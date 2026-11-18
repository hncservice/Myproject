// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { logoutSession } from '../api/authApi';

const TOKEN_KEY = 'token';
const ROLE_KEY = 'role';
const PROFILE_KEY = 'profile';

const AuthContext = createContext(null);
const readStorage = key => { try { return localStorage.getItem(key) || null; } catch { return null; } };
const persist = (key, value) => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* unavailable storage never prevents in-memory sign-out */ } };

export const AuthProvider = ({ children }) => {
  const [logoutWarning, setLogoutWarning] = useState('');
  const [token, setToken] = useState(() => readStorage(TOKEN_KEY));
  const [role, setRole] = useState(() => readStorage(ROLE_KEY));
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(readStorage(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    persist(TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    persist(ROLE_KEY, role);
  }, [role]);

  useEffect(() => {
    persist(PROFILE_KEY, profile ? JSON.stringify(profile) : null);
  }, [profile]);

  const login = (roleValue, tokenValue, profileValue) => {
    if (!['user', 'vendor', 'admin'].includes(roleValue) || typeof tokenValue !== 'string' || !tokenValue || !profileValue || typeof profileValue !== 'object') throw new Error('Invalid authentication response');
    setLogoutWarning('');
    setRole(roleValue);
    setToken(tokenValue);
    setProfile(profileValue);
  };

  const logout = async () => {
    const previousToken = token;
    // ✅ clear localStorage using your real keys
    persist(TOKEN_KEY, null);
    persist(ROLE_KEY, null);
    persist(PROFILE_KEY, null);

    // ✅ clear state
    setToken(null);
    setRole(null);
    setProfile(null);
    if (previousToken) {
      try { await logoutSession(previousToken); setLogoutWarning(''); }
      catch { setLogoutWarning('Local sign-out complete. Server revocation could not be confirmed.'); }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        profile,
        login,
        logout,
        logoutWarning,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
