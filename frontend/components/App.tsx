'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { RecordBackupBar } from './RecordBackupBar';
import { RecordMergeDialog } from './RecordMergeDialog';
import { AccountScreen } from './AccountScreen';
import { clearRecordBackupMarkers, useRecordBackup } from '../lib/useRecordBackup';

type Mode = 'main' | 'box' | 'vending' | 'luck' | 'hit-dex' | 'account';
type PokesimHistoryState = {
  mode: Mode;
  selectedSetCode: string | null;
};

const HISTORY_STATE_KEY = 'pokesimApp';

function isMode(value: unknown): value is Mode {
  return value === 'main' || value === 'box' || value === 'vending' || value === 'luck' || value === 'hit-dex' || value === 'account';
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

function pendingRecordAuthReturn(): 'luck' | 'hit-dex' | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(AUTH_RETURN_MODE_KEY);
  window.sessionStorage.removeItem(AUTH_RETURN_MODE_KEY);
  return value === 'luck' || value === 'hit-dex' ? value : null;
}

function currentHistoryUrlWithoutHitDexDebug() {
  const params = new URLSearchParams(window.location.search);
  params.delete('debugHitDex');
  params.delete('debugAuth');
  const search = params.toString();
  return `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
}

function googleAccountId(email: string | undefined): string | null {
  const accountId = email?.split('@')[0]?.trim();
  return accountId || null;
}

function authDisplayName(session: ReturnType<typeof useGoogleAuth>['session']): string | null {
  if (!session) return null;

  const metadata = session.user.user_metadata as Record<string, unknown>;
  const customDisplayName = metadata.display_name;
  if (typeof customDisplayName === 'string' && customDisplayName.trim()) {
    return customDisplayName.trim();
  }

  return googleAccountId(session.user.email) ?? 'Google 사용자';
}

function authNickname(session: ReturnType<typeof useGoogleAuth>['session']): string {
  return authDisplayName(session) ?? '';
}

export function App({ sets }: { sets: SetMeta[] }) {
  const [mode, setMode] = useState<Mode>('main');
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);
  const [localAuthPreview, setLocalAuthPreview] = useState(false);
  const initialModeRef = useRef<Mode | null>(null);
  const auth = useGoogleAuth();
  const authUserId = auth.session?.user.id ?? null;
  const records = useRecordBackup({
    userId: authUserId,
    authReady: auth.ready,
    sets,
    disabled: localAuthPreview,
  });

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
      const returningFromAuth = pendingRecordAuthReturn();
      initialModeRef.current = isLocalDebugHitDexRequest() ? 'hit-dex' : (returningFromAuth ?? 'main');
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
    setMode('main');
    setSelectedSet(null);
    window.history.replaceState(
      withPokesimHistoryState(window.history.state, { mode: 'main', selectedSetCode: null }),
      '',
      isLocalDebugHitDexRequest() || isLocalAuthPreviewRequest()
        ? currentHistoryUrlWithoutHitDexDebug()
        : currentHistoryUrl(),
    );
    setLocalAuthPreview(false);
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

  const recordBackupBar = () => (
    <RecordBackupBar
      authenticated={Boolean(authUserId)}
      displayName={authDisplayName(auth.session)}
      authReady={auth.ready}
      authPending={auth.pending}
      status={records.status}
      error={auth.error ?? records.error}
      onGoogleCredential={auth.signInWithGoogleIdToken}
      onRetry={() => void records.retry().catch(() => undefined)}
      onSignOut={async () => {
        if (authUserId) await records.retry().catch(() => undefined);
        await auth.signOut();
        goMain();
      }}
      onOpenAccount={() => {
        if (mode !== 'account') pushHistoryState('account');
      }}
    />
  );

  const renderScreen = (screen: ReactNode) => (
    <>
      {screen}
      {records.guestSummary ? (
        <RecordMergeDialog
          summary={records.guestSummary}
          pending={records.mergePending}
          error={records.error}
          onMerge={() => void records.mergeGuestRecords()}
          onKeepSeparate={records.keepGuestSeparate}
        />
      ) : null}
    </>
  );
  if (mode === 'main') {
    return renderScreen(
      <MainScreen
        onOpenLuck={() => {
          trackUserEvent({ eventName: 'open_luck', metadata: { source: 'main_cta' } });
          pushHistoryState('luck');
        }}
        onOpenHitDex={() => pushHistoryState('hit-dex')}
        onSelectMode={(m) => {
          trackUserEvent({ eventName: 'select_mode', mode: m });
          pushHistoryState(m);
        }}
        recordSession={records.session}
        recordHitDex={records.hitDex}
        onResetRecords={() => records.resetOpeningRecords()}
        accountBar={recordBackupBar()}
      />
    );
  }

  if (mode === 'account') {
    return renderScreen(
      <AccountScreen
        email={auth.session?.user.email ?? ''}
        displayName={authNickname(auth.session)}
        authPending={auth.pending}
        authError={auth.error}
        onBackToMain={goMain}
        onSaveDisplayName={auth.updateDisplayName}
        onDeleteAccount={async () => {
          const deletingUserId = authUserId;
          await auth.deleteAccount();
          if (deletingUserId) clearRecordBackupMarkers(deletingUserId);
          goMain();
        }}
        accountBar={recordBackupBar()}
      />,
    );
  }

  if (mode === 'hit-dex') {
    return renderScreen(
      <HitDexScreen
        sets={sets}
        hitDex={records.hitDex}
        onBackToMain={goMain}
        backupBar={recordBackupBar()}
      />
    );
  }

  if (mode === 'vending') {
    return renderScreen(
      <VendingMachine
        sets={sets}
        onBackToMain={goMain}
        onOpenHitDex={() => pushHistoryState('hit-dex')}
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
        accountBar={recordBackupBar()}
      />
    );
  }

  if (mode === 'luck') {
    return renderScreen(
      <LuckScreen
        sets={sets}
        session={records.session}
        initialSetCode={selectedSet?.code ?? null}
        onBackToMain={goMain}
        onResetRecords={records.resetOpeningRecords}
        backupBar={recordBackupBar()}
      />,
    );
  }

  // box mode
  if (!selectedSet) {
    return renderScreen(
      <SetPicker
        sets={sets}
        onSelect={(set) => {
          trackUserEvent({ eventName: 'select_set', mode: 'box', setCode: set.code });
          pushHistoryState('box', set);
        }}
        onBackToMain={goMain}
        accountBar={recordBackupBar()}
      />
    );
  }
  if (selectedSet.type === 'starter') {
    return renderScreen(
      <StartDeckSimulator
        key={selectedSet.code}
        setMeta={selectedSet}
        onChangeSet={goBoxPicker}
        onOpenHitDex={() => pushHistoryState('hit-dex')}
        onOpenLuck={(resultMode) => {
          trackUserEvent({
            eventName: 'open_luck',
            setCode: selectedSet.code,
            mode: resultMode,
            metadata: { source: 'starter_result' },
          });
          pushHistoryState('luck', selectedSet);
        }}
        accountBar={recordBackupBar()}
      />
    );
  }
  return renderScreen(
    <BoxSimulator
      key={selectedSet.code}
      setMeta={selectedSet}
      onChangeSet={goBoxPicker}
      onOpenHitDex={() => pushHistoryState('hit-dex')}
      onOpenLuck={(resultMode) => {
        trackUserEvent({
          eventName: 'open_luck',
          setCode: selectedSet.code,
          mode: resultMode,
          metadata: { source: resultMode === 'pack' ? 'pack_result' : 'box_result' },
        });
        pushHistoryState('luck', selectedSet);
      }}
      accountBar={recordBackupBar()}
    />
  );
}
