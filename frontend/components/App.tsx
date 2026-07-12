'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetMeta } from '../lib/types';
import { AUTH_RETURN_MODE_KEY, useGoogleAuth } from '../lib/auth';
import { trackUserEvent } from '../lib/statsTracker';
import { MainScreen } from './MainScreen';
import { SetPicker } from './SetPicker';
import { BoxSimulator } from './BoxSimulator';
import { StartDeckSimulator } from './StartDeckSimulator';
import { VendingMachine } from './VendingMachine';
import { LuckScreen } from './LuckScreen';
import { HitDexScreen } from './HitDexScreen';

type Mode = 'main' | 'box' | 'vending' | 'luck' | 'hit-dex';
type PokesimHistoryState = {
  mode: Mode;
  selectedSetCode: string | null;
};

const HISTORY_STATE_KEY = 'pokesimApp';

function isMode(value: unknown): value is Mode {
  return value === 'main' || value === 'box' || value === 'vending' || value === 'luck' || value === 'hit-dex';
}

function readPokesimHistoryState(state: unknown): PokesimHistoryState | null {
  if (!state || typeof state !== 'object') return null;

  const appState = (state as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (!appState || typeof appState !== 'object') return null;

  const mode = (appState as Record<string, unknown>).mode;
  if (!isMode(mode)) return null;

  const selectedSetCode = (appState as Record<string, unknown>).selectedSetCode;
  return {
    mode,
    selectedSetCode: typeof selectedSetCode === 'string' ? selectedSetCode : null,
  };
}

function withPokesimHistoryState(state: unknown, appState: PokesimHistoryState) {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, [HISTORY_STATE_KEY]: appState };
}

function currentHistoryUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isLocalDebugHitDexRequest(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) return false;
  return new URLSearchParams(window.location.search).get('debugHitDex') === 'full';
}

function isLocalAuthPreviewRequest(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) return false;
  return new URLSearchParams(window.location.search).get('debugAuth') === '1';
}

function hasPendingHitDexAuthReturn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(AUTH_RETURN_MODE_KEY) === 'hit-dex';
}

function currentHistoryUrlWithoutHitDexDebug() {
  const params = new URLSearchParams(window.location.search);
  params.delete('debugHitDex');
  params.delete('debugAuth');
  const search = params.toString();
  return `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
}

export function App({ sets }: { sets: SetMeta[] }) {
  const [mode, setMode] = useState<Mode>('main');
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);
  const [localAuthPreview, setLocalAuthPreview] = useState(false);
  const initialModeRef = useRef<Mode | null>(null);
  const auth = useGoogleAuth();
  const hitDexAccessGranted = Boolean(auth.session) || localAuthPreview;

  const applyHistoryState = useCallback(
    (state: unknown) => {
      const appState = readPokesimHistoryState(state);
      if (!appState) {
        setMode('main');
        setSelectedSet(null);
        return;
      }

      setMode(appState.mode);
      if ((appState.mode === 'box' || appState.mode === 'luck') && appState.selectedSetCode) {
        setSelectedSet(sets.find((set) => set.code === appState.selectedSetCode) ?? null);
      } else {
        setSelectedSet(null);
      }
    },
    [sets],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    trackUserEvent({
      eventName: 'page_view',
      metadata: {
        path: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      },
    });
  }, []);

  useEffect(() => {
    if (initialModeRef.current === null) {
      const returningFromAuth = hasPendingHitDexAuthReturn();
      initialModeRef.current = isLocalDebugHitDexRequest() || returningFromAuth ? 'hit-dex' : 'main';
      if (returningFromAuth) window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
    }

    const initialMode = initialModeRef.current;
    const previewTimer = window.setTimeout(() => {
      setLocalAuthPreview(isLocalAuthPreviewRequest());
    }, 0);
    window.history.replaceState(
      withPokesimHistoryState(window.history.state, { mode: initialMode, selectedSetCode: null }),
      '',
      currentHistoryUrl(),
    );
    if (initialMode !== 'main') {
      window.setTimeout(() => {
        setMode(initialMode);
        setSelectedSet(null);
      }, 0);
    }

    const handlePopState = (event: PopStateEvent) => {
      applyHistoryState(event.state);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.clearTimeout(previewTimer);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyHistoryState]);

  const pushHistoryState = useCallback((nextMode: Mode, nextSet: SetMeta | null = null) => {
    window.history.pushState(
      withPokesimHistoryState(window.history.state, {
        mode: nextMode,
        selectedSetCode: nextSet?.code ?? null,
      }),
      '',
      currentHistoryUrl(),
    );
    setMode(nextMode);
    setSelectedSet(nextSet);
  }, []);

  const goMain = () => {
    if (isLocalDebugHitDexRequest() || isLocalAuthPreviewRequest()) {
      setMode('main');
      setSelectedSet(null);
      window.history.replaceState(
        withPokesimHistoryState(window.history.state, { mode: 'main', selectedSetCode: null }),
        '',
        currentHistoryUrlWithoutHitDexDebug(),
      );
      setLocalAuthPreview(false);
      return;
    }

    const appState = readPokesimHistoryState(window.history.state);
    if (appState && appState.mode !== 'main') {
      window.history.back();
      return;
    }

    setMode('main');
    setSelectedSet(null);
    window.history.replaceState(
      withPokesimHistoryState(window.history.state, { mode: 'main', selectedSetCode: null }),
      '',
      currentHistoryUrl(),
    );
  };

  const goBoxPicker = () => {
    const appState = readPokesimHistoryState(window.history.state);
    if (appState?.mode === 'box' && appState.selectedSetCode) {
      window.history.back();
      return;
    }

    setMode('box');
    setSelectedSet(null);
    window.history.replaceState(
      withPokesimHistoryState(window.history.state, { mode: 'box', selectedSetCode: null }),
      '',
      currentHistoryUrl(),
    );
  };

  if (mode === 'main') {
    return (
      <MainScreen
        onOpenLuck={() => {
          trackUserEvent({ eventName: 'open_luck', metadata: { source: 'main_cta' } });
          pushHistoryState('luck');
        }}
        onSelectMode={(m) => {
          trackUserEvent({ eventName: 'select_mode', mode: m });
          pushHistoryState(m);
        }}
        onOpenHitDex={() => {
          trackUserEvent({ eventName: 'select_mode', metadata: { mode: 'hit_dex', source: 'main_hit_dex' } });
          pushHistoryState('hit-dex');
        }}
        hitDexAccessGranted={hitDexAccessGranted}
      />
    );
  }

  if (mode === 'hit-dex') {
    return (
      <HitDexScreen
        sets={sets}
        onBackToMain={goMain}
        authReady={auth.ready}
        authPending={auth.pending}
        authError={auth.error}
        accessGranted={hitDexAccessGranted}
        localAuthPreview={localAuthPreview}
        onSignIn={auth.signInWithGoogle}
        onSignOut={auth.signOut}
      />
    );
  }

  if (mode === 'vending') {
    return (
      <VendingMachine
        sets={sets}
        onBackToMain={goMain}
        onOpenLuck={(setCode) => {
          const targetSet = setCode ? (sets.find((set) => set.code === setCode) ?? null) : null;
          trackUserEvent({
            eventName: 'open_luck',
            setCode,
            mode: 'vending',
            metadata: { source: 'vending_result' },
          });
          pushHistoryState('luck', targetSet);
        }}
      />
    );
  }

  if (mode === 'luck') {
    return <LuckScreen sets={sets} initialSetCode={selectedSet?.code ?? null} onBackToMain={goMain} />;
  }

  // box mode
  if (!selectedSet) {
    return (
      <SetPicker
        sets={sets}
        onSelect={(set) => {
          trackUserEvent({ eventName: 'select_set', mode: 'box', setCode: set.code });
          pushHistoryState('box', set);
        }}
        onBackToMain={goMain}
      />
    );
  }
  if (selectedSet.type === 'starter') {
    return (
      <StartDeckSimulator
        key={selectedSet.code}
        setMeta={selectedSet}
        onChangeSet={goBoxPicker}
        onOpenLuck={(resultMode) => {
          trackUserEvent({
            eventName: 'open_luck',
            setCode: selectedSet.code,
            mode: resultMode,
            metadata: { source: 'starter_result' },
          });
          pushHistoryState('luck', selectedSet);
        }}
      />
    );
  }
  return (
    <BoxSimulator
      key={selectedSet.code}
      setMeta={selectedSet}
      onChangeSet={goBoxPicker}
      onOpenLuck={(resultMode) => {
        trackUserEvent({
          eventName: 'open_luck',
          setCode: selectedSet.code,
          mode: resultMode,
          metadata: { source: resultMode === 'pack' ? 'pack_result' : 'box_result' },
        });
        pushHistoryState('luck', selectedSet);
      }}
    />
  );
}
