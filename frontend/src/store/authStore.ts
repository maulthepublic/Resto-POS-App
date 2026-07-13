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
  authToken: string | null;
  pinCache: string | null; // in-memory saja, tidak persist, buat re-auth otomatis
  error: string | null;
  loading: boolean;
  loginWithPin: (pin: string) => Promise<boolean>;
  refreshAuthToken: () => Promise<boolean>;
  // PIN update goes directly to the auth endpoint — never via sync queue
  updatePin: (targetUserId: string, newPin: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  authToken: null,
  pinCache: null,
  error: null,
  loading: false,

  loginWithPin: async (pin: string) => {
    set({ loading: true, error: null });
    try {
      // 1. Validasi lokal dulu, ini yang bikin login tetap jalan walau offline
      const allSettings = await db.appSettings.toArray();
      const match = allSettings.find((s) => s.key.startsWith('pin:') && s.value === pin);

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
      set({ currentUser: session, pinCache: pin, loading: false });

      // 2. Coba dapetin JWT dari backend, tapi ini tidak boleh menggagalkan login
      // kalau offline atau server tidak bisa dihubungi
      try {
        const res = await fetch('/api/auth/login-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          const data = await res.json();
          const token = data?.data?.token;
          if (token) {
            localStorage.setItem('resto_pos_token', token);
            set({ authToken: token });
          }
        }
      } catch {
        // Server tidak terjangkau, tidak apa, session lokal tetap valid
        // sync akan menunggu sampai token berhasil didapat
      }

      return true;
    } catch (err: any) {
      set({ error: err.message || 'Terjadi kesalahan sistem saat login.', loading: false });
      return false;
    }
  },

  // Dipanggil networkStore saat koneksi baru pulih dan token belum ada
  refreshAuthToken: async () => {
    const pin = get().pinCache;
    if (!pin) return false;

    try {
      const res = await fetch('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      const token = data?.data?.token;
      if (!token) return false;

      localStorage.setItem('resto_pos_token', token);
      set({ authToken: token });
      return true;
    } catch {
      return false;
    }
  },

  // Update PIN via dedicated backend endpoint — never store or transmit plaintext through sync queue.
  // Backend is responsible for bcrypt hashing before saving.
  updatePin: async (targetUserId: string, newPin: string) => {
    const token = get().authToken;
    if (!token) {
      return { ok: false, message: 'Belum terautentikasi ke server. Sambungkan internet dan login ulang.' };
    }

    try {
      const res = await fetch(`/api/auth/users/${targetUserId}/set-pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: newPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, message: data?.message || 'Gagal memperbarui PIN.' };
      }

      // Update lokal IndexedDB agar offline login tetap pakai PIN terbaru
      await db.appSettings.put({ key: `pin:${targetUserId}`, value: newPin });

      // Jika user yang diubah adalah user yang sedang login, perbarui pinCache
      // agar refreshAuthToken() tetap bisa mendapatkan token baru
      if (get().currentUser?.id === targetUserId) {
        set({ pinCache: newPin });
      }

      return { ok: true, message: data?.data?.message || 'PIN berhasil diperbarui.' };
    } catch {
      return { ok: false, message: 'Tidak bisa menghubungi server. PIN tidak diperbarui.' };
    }
  },

  logout: () => {
    localStorage.removeItem('resto_pos_session');
    localStorage.removeItem('resto_pos_token');
    set({ currentUser: null, authToken: null, pinCache: null });
  },

  checkSession: () => {
    const stored = localStorage.getItem('resto_pos_session');
    const token = localStorage.getItem('resto_pos_token');
    if (stored) {
      try {
        set({ currentUser: JSON.parse(stored), authToken: token || null });
      } catch {
        localStorage.removeItem('resto_pos_session');
      }
    }
  },
}));