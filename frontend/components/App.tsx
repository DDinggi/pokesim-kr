'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SetMeta } from '../lib/types';
import { trackUserEvent } from '../lib/statsTracker';
import { MainScreen } from './MainScreen';
import { SetPicker } from './SetPicker';
import { BoxSimulator } from './BoxSimulator';
import { VendingMachine } from './VendingMachine';

type Mode = 'main' | 'box' | 'vending';
type PokesimHistoryState = {
  mode: Mode;
  selectedSetCode: string | null;
};

const HISTORY_STATE_KEY = 'pokesimApp';

function isMode(value: unknown): value is Mode {
  return value === 'main' || value === 'box' || value === 'vending';
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

export function App({ sets }: { sets: SetMeta[] }) {
  const [mode, setMode] = useState<Mode>('main');
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);

  const applyHistoryState = useCallback(
    (state: unknown) => {
      const appState = readPokesimHistoryState(state);
      if (!appState) {
        setMode('main');
        setSelectedSet(null);
        return;
      }

      setMode(appState.mode);
      if (appState.mode === 'box' && appState.selectedSetCode) {
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
    window.history.replaceState(
      withPokesimHistoryState(window.history.state, { mode: 'main', selectedSetCode: null }),
      '',
      currentHistoryUrl(),
    );

    const handlePopState = (event: PopStateEvent) => {
      applyHistoryState(event.state);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
        onSelectMode={(m) => {
          trackUserEvent({ eventName: 'select_mode', mode: m });
          pushHistoryState(m);
        }}
      />
    );
  }

  if (mode === 'vending') {
    return <VendingMachine sets={sets} onBackToMain={goMain} />;
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
  return <BoxSimulator key={selectedSet.code} setMeta={selectedSet} onChangeSet={goBoxPicker} />;
}
