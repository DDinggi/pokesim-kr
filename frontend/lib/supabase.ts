import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? '';

type AuthSettings = {
  external?: Record<string, boolean>;
};

export const supabase = url && key
  ? createClient(url, key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // OAuth callback exchange is handled explicitly in useGoogleAuth so the
      // one-time code is removed on both success and failure.
      detectSessionInUrl: false,
    },
  })
  : null;

export async function isGoogleAuthProviderEnabled(): Promise<boolean | null> {
  if (!url || !key) return false;

  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (!response.ok) return null;

    const settings = await response.json() as AuthSettings;
    return settings.external?.google === true;
  } catch {
    return null;
  }
}
