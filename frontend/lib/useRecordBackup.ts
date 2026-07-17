'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_BACKUP_INTENT_KEY } from './auth';
import {
  clearGuestHitDex,
  getGuestHitDex,
  mergeGuestHitDexIntoOwner,
} from './hitDex';
import { HIT_DEX_LOCAL_CHANGE_EVENT } from './hitDexEvents';
import {
  clearGuestOpeningSession,
  EMPTY_OPENING_SESSION,
  getGuestOpeningSession,
  loadOpeningSession,
  mergeGuestOpeningIntoOwner,
  OPENING_HISTORY_LOCAL_CHANGE_EVENT,
  removeOpeningSet,
  saveOpeningSession,
} from './openingHistory';
import {
  buildDisplayedRecords,
  EMPTY_RECORD_BACKUP,
  fetchRecordBackup,
  hydrateCurrentRecordSource,
  updateRecordBackup,
  withCurrentRecordSource,
  withoutOpeningRecords,
  type CloudRecordBackup,
} from './recordBackup';
import type { SetMeta } from './types';

const MERGE_MARKER_PREFIX = 'pokesim-kr-record-merge-v1:';
const KEEP_SEPARATE_MARKER_PREFIX = 'pokesim-kr-record-separate-v1:';

export function clearRecordBackupMarkers(userId: string): void {
  if (typeof window === 'undefined') return;
  const encodedUserId = encodeURIComponent(userId);
  window.localStorage.removeItem(`${MERGE_MARKER_PREFIX}${encodedUserId}`);
  window.localStorage.removeItem(`${KEEP_SEPARATE_MARKER_PREFIX}${encodedUserId}`);
}

export type RecordBackupStatus = 'local' | 'loading' | 'syncing' | 'synced' | 'error';

export interface GuestRecordSummary {
  boxes: number;
  packs: number;
  uniqueHitCards: number;
  totalHitCards: number;
}

function isRecordBackupSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record.code ?? '');
  const message = String(record.message ?? '');
  return code === 'PGRST202'
    || code === 'PGRST205'
    || code === '42P01'
    || message.includes('save_user_record_backup')
    || message.includes('user_record_backups');
}

function backupErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const record = error as { code?: unknown; message?: unknown };
    const message = record.message;
    if (isRecordBackupSchemaMissing(error)) {
      return '기록 보관 서버 설정이 아직 반영되지 않았습니다. 이 브라우저의 기록은 그대로 유지됩니다.';
    }
    if (typeof message === 'string' && message) return message;
  }
  return '기록을 보관하지 못했습니다. 브라우저 기록은 그대로 남아 있습니다.';
}

function hasBackupIntent(): boolean {
  return window.sessionStorage.getItem(AUTH_BACKUP_INTENT_KEY) === '1';
}

function clearBackupIntent(): void {
  window.sessionStorage.removeItem(AUTH_BACKUP_INTENT_KEY);
}

function guestRecordSignature(): string {
  const session = getGuestOpeningSession();
  const hitDex = getGuestHitDex();
  return JSON.stringify({
    totals: [session.boxes, session.packs, session.cost, session.cards.length],
    edgeCards: [
      session.cards[0]?.card_num ?? null,
      session.cards.at(-1)?.card_num ?? null,
    ],
    events: session.openingEvents.map((event) => event.id).sort(),
    dex: hitDex.entries
      .map((entry) => [entry.key, entry.pullCount])
      .sort(([left], [right]) => String(left).localeCompare(String(right))),
  });
}

function getGuestSummary(): GuestRecordSummary | null {
  const session = getGuestOpeningSession();
  const hitDex = getGuestHitDex();
  const hasOpeningRecords = session.openingEvents.length > 0
    || session.cards.length > 0
    || session.boxes > 0
    || session.packs > 0
    || session.cost > 0;
  if (!hasOpeningRecords && hitDex.entries.length === 0) return null;

  return {
    boxes: session.boxes,
    packs: session.packs,
    uniqueHitCards: hitDex.entries.length,
    totalHitCards: hitDex.entries.reduce((sum, entry) => sum + entry.pullCount, 0),
  };
}

export function useRecordBackup({
  userId,
  authReady,
  sets,
  disabled = false,
}: {
  userId: string | null;
  authReady: boolean;
  sets: SetMeta[];
  disabled?: boolean;
}) {
  const [cloud, setCloud] = useState<CloudRecordBackup>(EMPTY_RECORD_BACKUP);
  const [, setLocalRevision] = useState(0);
  const [status, setStatus] = useState<RecordBackupStatus>('local');
  const [error, setError] = useState<string | null>(null);
  const [guestSummary, setGuestSummary] = useState<GuestRecordSummary | null>(null);
  const [mergePending, setMergePending] = useState(false);
  const cloudRef = useRef<CloudRecordBackup>(EMPTY_RECORD_BACKUP);
  const activeUserRef = useRef(userId);
  const syncInFlightRef = useRef<{
    userId: string;
    promise: Promise<CloudRecordBackup>;
  } | null>(null);
  const schemaUnavailableRef = useRef(false);

  useEffect(() => {
    activeUserRef.current = userId;
  }, [userId]);

  const commitCloud = useCallback((nextCloud: CloudRecordBackup) => {
    cloudRef.current = nextCloud;
    setCloud(nextCloud);
    return nextCloud;
  }, []);

  const runSync = useCallback(async () => {
    if (!userId || disabled) return cloudRef.current;
    if (syncInFlightRef.current?.userId === userId) {
      return syncInFlightRef.current.promise;
    }

    setStatus('syncing');
    setError(null);
    const task = updateRecordBackup(
      userId,
      cloudRef.current,
      (payload) => withCurrentRecordSource(payload, userId),
    )
      .then((nextCloud) => {
        schemaUnavailableRef.current = false;
        if (activeUserRef.current === userId) {
          commitCloud(nextCloud);
          setStatus('synced');
        }
        return nextCloud;
      })
      .catch((syncError: unknown) => {
        if (isRecordBackupSchemaMissing(syncError)) schemaUnavailableRef.current = true;
        if (activeUserRef.current === userId) {
          setStatus('error');
          setError(backupErrorMessage(syncError));
        }
        throw syncError;
      })
      .finally(() => {
        if (syncInFlightRef.current?.promise === task) syncInFlightRef.current = null;
      });
    syncInFlightRef.current = { userId, promise: task };
    return task;
  }, [commitCloud, disabled, userId]);

  useEffect(() => {
    if (!authReady || !userId || disabled) {
      const timer = window.setTimeout(() => {
        if (authReady && !userId) clearBackupIntent();
        commitCloud(EMPTY_RECORD_BACKUP);
        setStatus('local');
        setError(null);
        setGuestSummary(null);
        setLocalRevision((current) => current + 1);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const loadTimer = window.setTimeout(() => {
      setStatus('loading');
      setError(null);
      void fetchRecordBackup(userId).then((nextCloud) => {
        if (cancelled) return;
        schemaUnavailableRef.current = false;
        hydrateCurrentRecordSource(userId, nextCloud, sets);
        commitCloud(nextCloud);
        setLocalRevision((current) => current + 1);
        const intent = hasBackupIntent();
        const summary = getGuestSummary();
        const signature = summary ? guestRecordSignature() : null;
        const separateMarkerKey = `${KEEP_SEPARATE_MARKER_PREFIX}${encodeURIComponent(userId)}`;
        const wasKeptSeparate = signature
          ? window.localStorage.getItem(separateMarkerKey) === signature
          : false;
        setGuestSummary(summary && (intent || !wasKeptSeparate) ? summary : null);
        if (!summary || (!intent && wasKeptSeparate)) clearBackupIntent();
        return runSync();
      })
      .then(() => {
        if (!cancelled) setStatus('synced');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        if (isRecordBackupSchemaMissing(loadError)) schemaUnavailableRef.current = true;
        setStatus('error');
        setError(backupErrorMessage(loadError));
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
    };
  }, [authReady, commitCloud, disabled, runSync, sets, userId]);

  useEffect(() => {
    let syncTimer: number | null = null;
    const handleLocalChange = () => {
      setLocalRevision((current) => current + 1);
      if (!userId || disabled || schemaUnavailableRef.current) return;
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        void runSync().catch(() => undefined);
      }, 15_000);
    };

    window.addEventListener(OPENING_HISTORY_LOCAL_CHANGE_EVENT, handleLocalChange);
    window.addEventListener(HIT_DEX_LOCAL_CHANGE_EVENT, handleLocalChange);
    return () => {
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      window.removeEventListener(OPENING_HISTORY_LOCAL_CHANGE_EVENT, handleLocalChange);
      window.removeEventListener(HIT_DEX_LOCAL_CHANGE_EVENT, handleLocalChange);
    };
  }, [disabled, runSync, userId]);

  useEffect(() => {
    if (!userId || disabled) return;
    const flush = () => {
      if (schemaUnavailableRef.current) return;
      void runSync().catch(() => undefined);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flushWhenHidden);
    };
  }, [disabled, runSync, userId]);

  const displayed = buildDisplayedRecords(cloud, userId, sets);

  const mergeGuestRecords = useCallback(async () => {
    if (!userId) return;
    setMergePending(true);
    setError(null);

    const markerKey = `${MERGE_MARKER_PREFIX}${encodeURIComponent(userId)}`;
    const signature = guestRecordSignature();
    try {
      if (window.localStorage.getItem(markerKey) !== signature) {
        mergeGuestOpeningIntoOwner(userId);
        mergeGuestHitDexIntoOwner(userId);
        window.localStorage.setItem(markerKey, signature);
      }

      setLocalRevision((current) => current + 1);
      if (syncInFlightRef.current?.userId === userId) {
        await syncInFlightRef.current.promise.catch(() => undefined);
      }
      await runSync();
      clearGuestOpeningSession();
      clearGuestHitDex();
      window.localStorage.removeItem(markerKey);
      window.localStorage.removeItem(
        `${KEEP_SEPARATE_MARKER_PREFIX}${encodeURIComponent(userId)}`,
      );
      clearBackupIntent();
      setGuestSummary(null);
      setLocalRevision((current) => current + 1);
    } catch (mergeError) {
      setError(backupErrorMessage(mergeError));
    } finally {
      setMergePending(false);
    }
  }, [runSync, userId]);

  const keepGuestSeparate = useCallback(() => {
    if (userId && getGuestSummary()) {
      window.localStorage.setItem(
        `${KEEP_SEPARATE_MARKER_PREFIX}${encodeURIComponent(userId)}`,
        guestRecordSignature(),
      );
    }
    clearBackupIntent();
    setGuestSummary(null);
  }, [userId]);

  const resetOpeningRecords = useCallback(async (setCode?: string) => {
    const set = setCode ? sets.find((candidate) => candidate.code === setCode) : null;
    const currentSession = loadOpeningSession(userId);
    const nextSession = set
      ? removeOpeningSet(
        currentSession,
        set.code,
        new Set(set.cards.map((card) => card.card_num)),
      )
      : EMPTY_OPENING_SESSION;
    saveOpeningSession(nextSession, userId);
    setLocalRevision((current) => current + 1);

    if (!userId || disabled) return;
    setStatus('syncing');
    setError(null);
    try {
      const nextCloud = await updateRecordBackup(
        userId,
        cloudRef.current,
        (payload) => withCurrentRecordSource(withoutOpeningRecords(payload, setCode), userId),
      );
      commitCloud(nextCloud);
      setStatus('synced');
    } catch (resetError) {
      setStatus('error');
      setError(backupErrorMessage(resetError));
    }
  }, [commitCloud, disabled, sets, userId]);

  return {
    session: displayed.session,
    hitDex: displayed.hitDex,
    status,
    error,
    guestSummary,
    mergePending,
    mergeGuestRecords,
    keepGuestSeparate,
    resetOpeningRecords,
    retry: runSync,
  };
}
