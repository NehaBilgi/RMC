import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(projectUrl && publicKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(projectUrl!, publicKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and add your public project URL and key.'
    );
  }
  return supabase;
}
