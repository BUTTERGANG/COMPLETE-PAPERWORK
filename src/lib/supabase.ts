import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[dj-ops] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set these in Replit Secrets.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
