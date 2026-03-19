/**
 * frontend/lib/auth.js
 * Token helpers — localStorage wrapper
 */
const TOKEN_KEY = 'migratebot_token';
const USER_KEY = 'migratebot_user';

export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
export const removeUser = () => localStorage.removeItem(USER_KEY);
