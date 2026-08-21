import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './config';

export const supabase = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
