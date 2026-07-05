// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabaseConfig';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
