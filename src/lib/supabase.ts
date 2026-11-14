import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Env o‘zgaruvchilari berilmagan bo‘lsa, ilova soxta ulanish o‘rniga sozlash ekranini ko‘rsatadi. */
export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** PostgREST/RPC javobini ochadi; xatoda istisno tashlaydi. */
export async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}
