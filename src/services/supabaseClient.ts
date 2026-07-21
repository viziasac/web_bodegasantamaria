// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey, logSupabaseConfigHint } from '../config/supabaseConfig';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAnonKey();
logSupabaseConfigHint();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': 'bodega-santa-maria-web',
    },
  },
});
