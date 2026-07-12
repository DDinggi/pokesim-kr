'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const AUTH_RETURN_MODE_KEY = 'pokesim-kr-auth-return-mode';

interface GoogleAuthState {
  session: Session | null;
  ready: boolean;
  pending: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export function useGoogleAuth(): GoogleAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(() => supabase === null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(authErrorMessage(sessionError));
      setSession(data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setReady(true);
      setPending(false);
      if (nextSession) setError(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);

    if (!supabase) {
      setError('로컬 환경에 Supabase 로그인 설정이 없습니다.');
      return;
    }

    setPending(true);
    window.sessionStorage.setItem(AUTH_RETURN_MODE_KEY, 'hit-dex');

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: 'openid email profile',
      },
    });

    if (signInError) {
      window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
      setPending(false);
      setError(authErrorMessage(signInError));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (!supabase) return;

    setPending(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    setPending(false);

    if (signOutError) {
      setError(authErrorMessage(signOutError));
      return;
    }

    setSession(null);
  }, []);

  return {
    session,
    ready,
    pending,
    error,
    signInWithGoogle,
    signOut,
  };
}
