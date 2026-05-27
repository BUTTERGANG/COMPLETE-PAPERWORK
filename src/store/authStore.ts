import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  userName: string | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signOut: () => void;
}

const isDev = () => !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
          console.warn('[auth] Replit identity not available');
        }
        // Dev mode fallback only
        if (isDev()) {
          set({ userId: 'dev-user', userName: 'Dev User', loading: false, initialized: true });
        } else {
          set({ userId: null, userName: null, loading: false, initialized: true });
        }
      },

      signOut: () => {
        set({ userId: null, userName: null, initialized: false });
      },
    }),
    {
      name: 'dj-ops-auth',
      partialize: (state) => ({ userId: state.userId, userName: state.userName }),
    }
  )
);
