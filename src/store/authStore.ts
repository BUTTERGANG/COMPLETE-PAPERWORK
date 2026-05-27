import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  userName: string | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  userName: null,
  loading: true,
  initialized: false,

  init: async () => {
    try {
      const resp = await fetch('/api/auth/user');
      if (resp.ok) {
        const data = await resp.json();
        set({ userId: data.userId, userName: data.userName, loading: false, initialized: true });
        return;
      }
    } catch {
      // Fallback: use a default local user-id for dev
      console.warn('[auth] Replit identity not available, using local dev mode');
    }
    // Dev mode fallback
    set({ userId: 'dev-user', userName: 'Dev User', loading: false, initialized: true });
  },

  signOut: () => {
    set({ userId: null, userName: null, initialized: false });
  },
}));
