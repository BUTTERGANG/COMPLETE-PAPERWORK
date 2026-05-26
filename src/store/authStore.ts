import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<(() => void) | undefined>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let authListenerCleanup: (() => void) | null = null;

  return {
    user: null,
    loading: true,
    initialized: false,

    init: async () => {
      if (get().initialized) return authListenerCleanup ?? undefined;

      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, loading: false, initialized: true });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });

      authListenerCleanup = () => {
        subscription.unsubscribe();
      };

      return authListenerCleanup;
    },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

    signOut: async () => {
      await supabase.auth.signOut();
      if (authListenerCleanup) {
        authListenerCleanup();
        authListenerCleanup = null;
      }
      set({ user: null, initialized: false });
    },
  };
});
