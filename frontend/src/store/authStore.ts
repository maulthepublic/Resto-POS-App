import { create } from 'zustand';
import { db } from '../db/localSchema';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'admin' | 'cashier' | 'chef';
}

interface AuthState {
  currentUser: UserSession | null;
  error: string | null;
  loading: boolean;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  error: null,
  loading: false,

  loginWithPin: async (pin: string) => {
    set({ loading: true, error: null });
    try {
      // Find matching pin in appSettings where value = pin
      // Dexie doesn't index 'value' directly unless specified, but we can query it locally or filter
      const allSettings = await db.appSettings.toArray();
      const match = allSettings.find(
        (s) => s.key.startsWith('pin:') && s.value === pin
      );

      if (!match) {
        set({ error: 'PIN yang Anda masukkan salah.', loading: false });
        return false;
      }

      const userId = match.key.replace('pin:', '');
      const user = await db.users.get(userId);

      if (!user || !user.isActive) {
        set({ error: 'Akun Anda dinonaktifkan.', loading: false });
        return false;
      }

      const session: UserSession = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      localStorage.setItem('resto_pos_session', JSON.stringify(session));
      set({ currentUser: session, loading: false });
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Terjadi kesalahan sistem saat login.',
        loading: false,
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('resto_pos_session');
    set({ currentUser: null });
  },

  checkSession: () => {
    const stored = localStorage.getItem('resto_pos_session');
    if (stored) {
      try {
        set({ currentUser: JSON.parse(stored) });
      } catch {
        localStorage.removeItem('resto_pos_session');
      }
    }
  },
}));
