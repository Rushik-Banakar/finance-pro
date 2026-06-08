import { create } from 'zustand';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

interface UserSettings {
  id: number;
  user_id: number;
  pin_hash?: string;
  is_pin_enabled: boolean;
  auto_lock_duration: number;
  session_timeout: number;
  currency: string;
  language: string;
  date_format: string;
  notification_pref: string;
  theme: string;
  theme_customization: string;
  hide_balance: boolean;
  lock_analytics: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  settings: UserSettings | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  lastActivityTime: number;
  
  // Actions
  login: (token: string, user: User, settings: UserSettings) => void;
  logout: () => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  setLocked: (locked: boolean) => void;
  updateActivity: () => void;
  checkAutoLock: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  settings: localStorage.getItem('settings') ? JSON.parse(localStorage.getItem('settings')!) : null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLocked: false,
  lastActivityTime: Date.now(),

  login: (token, user, settings) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('settings', JSON.stringify(settings));
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    set({
      token,
      user,
      settings,
      isAuthenticated: true,
      isLocked: settings.is_pin_enabled,
      lastActivityTime: Date.now()
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('settings');
    delete axios.defaults.headers.common['Authorization'];
    set({
      token: null,
      user: null,
      settings: null,
      isAuthenticated: false,
      isLocked: false
    });
  },

  updateSettings: (newSettings) => {
    set((state) => {
      if (!state.settings) return state;
      const updated = { ...state.settings, ...newSettings };
      localStorage.setItem('settings', JSON.stringify(updated));
      return { settings: updated };
    });
  },

  setLocked: (locked) => {
    set({ isLocked: locked, lastActivityTime: Date.now() });
  },

  updateActivity: () => {
    set({ lastActivityTime: Date.now() });
  },

  checkAutoLock: () => {
    const { settings, isLocked, isAuthenticated, lastActivityTime } = get();
    if (!isAuthenticated || isLocked || !settings || !settings.is_pin_enabled) return;

    const idleDuration = (Date.now() - lastActivityTime) / 1000;
    if (idleDuration >= settings.auto_lock_duration) {
      set({ isLocked: true });
    }
  }
}));

const savedToken = localStorage.getItem('token');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}
