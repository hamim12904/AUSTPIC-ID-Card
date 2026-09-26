import { create } from 'zustand';

const STORAGE_KEY = 'aust_pic_auth';

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const stored = loadStoredAuth();

export const useAuthStore = create((set) => ({
  user: stored?.user ?? null,
  token: stored?.token ?? null,
  isAuthenticated: Boolean(stored?.token),

  setAuth: ({ user, token }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
}));