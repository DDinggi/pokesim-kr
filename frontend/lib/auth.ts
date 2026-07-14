'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { clearOwnerHitDex, setActiveHitDexOwner } from './hitDex';
import { clearOwnerOpeningSession, setActiveOpeningOwner } from './openingHistory';
import { isGoogleAuthProviderEnabled, supabase } from './supabase';

export const AUTH_RETURN_MODE_KEY = 'pokesim-kr-auth-return-mode';
export const AUTH_BACKUP_INTENT_KEY = 'pokesim-kr-auth-backup-intent';

interface GoogleAuthState {
  session: Session | null;
  ready: boolean;
  pending: boolean;
  error: string | null;
  signInWithGoogleIdToken: (idToken: string, nonce: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

function authCallbackErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  if (code === 'pkce_code_verifier_not_found') {
    return '로그인을 시작한 주소와 돌아온 주소가 달라 인증을 완료하지 못했습니다. pokesim.kr에서 다시 로그인해주세요.';
  }

  return 'Google 로그인 확인에 실패했습니다. 로그인 버튼을 눌러 다시 시도해주세요.';
}

function clearOAuthCallbackParams(): void {
  const url = new URL(window.location.href);
  for (const key of ['code', 'error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
  }
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const key of ['code', 'error', 'error_code', 'error_description']) {
    hashParams.delete(key);
  }
  url.hash = hashParams.size > 0 ? `#${hashParams.toString()}` : '';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function readOAuthCallbackError(url: URL): string | null {
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  return url.searchParams.get('error_description')
    ?? url.searchParams.get('error')
    ?? hashParams.get('error_description')
    ?? hashParams.get('error');
}

export function useGoogleAuth(): GoogleAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(() => supabase === null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      const callbackUrl = new URL(window.location.href);
      const authCode = callbackUrl.searchParams.get('code');
      const callbackError = readOAuthCallbackError(callbackUrl);
      const hasOAuthCallback = Boolean(authCode || callbackError);
      let nextSession: Session | null = null;
      let sessionError: unknown = null;

      try {
        if (callbackError) {
          sessionError = new Error(callbackError);
          const { data: existing } = await client.auth.getSession();
          nextSession = existing.session;
        } else if (authCode) {
          const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(authCode);
          nextSession = data.session;
          sessionError = exchangeError;

          if (exchangeError) {
            const { data: existing } = await client.auth.getSession();
            nextSession = existing.session;
          }
        } else {
          const { data, error: getSessionError } = await client.auth.getSession();
          nextSession = data.session;
          sessionError = getSessionError;
        }
      } catch (initializationError) {
        sessionError = initializationError;
      } finally {
        if (hasOAuthCallback) clearOAuthCallbackParams();
      }

      if (!mounted) return;

      if (sessionError && !nextSession) {
        window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
        window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);
        setError(callbackError
          ? 'Google 로그인이 취소되었거나 승인되지 않았습니다. 다시 시도해주세요.'
          : authCode
            ? authCallbackErrorMessage(sessionError)
            : authErrorMessage(sessionError));
      } else {
        setError(null);
      }

      setActiveHitDexOwner(nextSession?.user.id ?? null);
      setActiveOpeningOwner(nextSession?.user.id ?? null);
      setSession(nextSession);
      setReady(true);

      const { data: listener } = client.auth.onAuthStateChange((_event, changedSession) => {
        if (!mounted) return;
        setActiveHitDexOwner(changedSession?.user.id ?? null);
        setActiveOpeningOwner(changedSession?.user.id ?? null);
        setSession(changedSession);
        setReady(true);
        setPending(false);
        if (changedSession) setError(null);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    };

    void initializeAuth();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, nonce: string) => {
    setError(null);

    if (!supabase) {
      setError('로컬 환경에 Supabase 로그인 설정이 없습니다.');
      return;
    }

    setPending(true);
    window.sessionStorage.setItem(AUTH_BACKUP_INTENT_KEY, '1');

    const providerEnabled = await isGoogleAuthProviderEnabled();
    if (providerEnabled === false) {
      window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);
      setPending(false);
      setError('Google 로그인이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce,
      });

      if (signInError) throw signInError;

      setActiveHitDexOwner(data.user?.id ?? null);
      setActiveOpeningOwner(data.user?.id ?? null);
      setSession(data.session);
      setPending(false);
    } catch (signInError) {
      window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);
      setPending(false);
      setError(authErrorMessage(signInError));
    }
  }, []);
  const signOut = useCallback(async () => {
    setError(null);
    window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
    window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);
    if (!supabase) return;

    setPending(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    setPending(false);

    if (signOutError) {
      setError(authErrorMessage(signOutError));
      return;
    }

    setActiveHitDexOwner(null);
    setActiveOpeningOwner(null);
    setSession(null);
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const nextDisplayName = displayName.trim();
    setError(null);

    if (!supabase || !session?.user.id) {
      const accountError = new Error('로그인한 계정을 확인하지 못했습니다.');
      setError(accountError.message);
      throw accountError;
    }
    if (!nextDisplayName || nextDisplayName.length > 20) {
      const displayNameError = new Error('닉네임은 1자 이상 20자 이하로 입력해주세요.');
      setError(displayNameError.message);
      throw displayNameError;
    }

    setPending(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { display_name: nextDisplayName },
      });
      if (updateError) throw updateError;
      if (data.user) {
        setSession((currentSession) => currentSession
          ? { ...currentSession, user: data.user }
          : currentSession);
      }
    } catch (updateError) {
      const message = authErrorMessage(updateError);
      setError(message);
      throw updateError;
    } finally {
      setPending(false);
    }
  }, [session]);
  const deleteAccount = useCallback(async () => {
    const currentUserId = session?.user.id;
    setError(null);

    if (!supabase || !currentUserId) {
      const accountError = new Error('로그인한 계정을 확인하지 못했습니다.');
      setError(accountError.message);
      throw accountError;
    }

    setPending(true);
    try {
      const { error: deleteError } = await supabase.rpc('delete_my_account');
      if (deleteError) throw deleteError;

      clearOwnerHitDex(currentUserId);
      clearOwnerOpeningSession(currentUserId);
      window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
      window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);

      await supabase.auth.signOut({ scope: 'local' });
      setActiveHitDexOwner(null);
      setActiveOpeningOwner(null);
      setSession(null);
    } catch (deleteError) {
      const message = authErrorMessage(deleteError);
      setError(message);
      throw deleteError;
    } finally {
      setPending(false);
    }
  }, [session]);

  return {
    session,
    ready,
    pending,
    error,
    signInWithGoogleIdToken,
    signOut,
    updateDisplayName,
    deleteAccount,
  };
}
