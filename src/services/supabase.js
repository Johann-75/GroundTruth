import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verify if credentials are configured and are not template placeholders
const isConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim() !== '' &&
  supabaseUrl !== 'your_supabase_url_here' &&
  supabaseAnonKey.trim() !== '' &&
  supabaseAnonKey !== 'your_supabase_anon_key_here'
);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Check if the Supabase client is configured and available.
 * @returns {boolean}
 */
export const isSupabaseConfigured = () => {
  return isConfigured && supabase !== null;
};
