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

  /**
   * Replaces just the profile, keeping the existing token. Used to re-read the
   * account from the database on load, so fields the server fills in on its own
   * (memberId) reach the card instead of being missing from a profile that was
   * cached before the account had one.
   */
  refreshUser: (user) => {
    if (!user) return;
    set((state) => {
      if (!state.token) return state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token: state.token }));
      return { user };
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
}));