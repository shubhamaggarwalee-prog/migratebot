/**
 * frontend/context/AuthContext.jsx
 * Global auth state — login, register, logout
 */
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { getToken, setToken, removeToken, getUser, setUser, removeUser } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const cached = getUser();
    if (token && cached) {
      setUserState(cached);
      api.get('/api/auth/me').then(r => { setUserState(r.user); setUser(r.user); }).catch(() => { removeToken(); removeUser(); setUserState(null); }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    setUserState(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api.post('/api/auth/register', { name, email, password });
    setToken(data.token);
    setUser(data.user);
    setUserState(data.user);
    return data.user;
  };

  const logout = () => { removeToken(); removeUser(); setUserState(null); };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
