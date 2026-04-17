import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('your_project_ref') ||
    normalized.includes('your_supabase_anon_key') ||
    normalized === 'your_supabase_url_here' ||
    normalized === 'your_supabase_anon_key_here'
  );
}

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    typeof url === 'string' &&
    url.length > 0 &&
    !isPlaceholderValue(url) &&
    typeof anonKey === 'string' &&
    anonKey.length > 0 &&
    !isPlaceholderValue(anonKey)
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Faltan variables de entorno de Supabase en el frontend');
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}
