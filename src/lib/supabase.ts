import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(url && key);

/** Sending anything needs internet; say so plainly instead of a technical network error. */
function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false && method !== 'GET' && method !== 'HEAD') {
    const te = typeof localStorage !== 'undefined' && localStorage.getItem('sachiseva-lang') === 'te';
    return Promise.reject(new Error(te ? 'ఇంటర్నెట్ లేదు. మీ వివరాలు ఈ పేజీలోనే ఉన్నాయి — ఇంటర్నెట్ వచ్చాక మళ్లీ పంపండి.' : 'No internet. Your details are still on this page — send again when you are back online.'));
  }
  return fetch(input, init);
}

/**
 * Untyped on purpose: the DB has grown past the old generated types, and a
 * stale `Database` generic produced more false errors than it caught.
 * Row shapes live in src/types.
 */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 5 } },
    global: { fetch: offlineAwareFetch },
  },
);

/** Storage keys must be ASCII-safe; Telugu file names or spaces break uploads. */
export function safeStorageName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'file'}-${Date.now().toString(36)}${ext}`;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'doc';
}

export const MAX_UPLOAD_MB = 10;
