'use client';

import Link from 'next/link';
import type { RecordBackupStatus } from '../lib/useRecordBackup';
import { GoogleSignInButton } from './GoogleSignInButton';

export interface RecordBackupBarProps {
  authenticated: boolean;
  displayName: string | null;
  authReady: boolean;
  authPending: boolean;
  status: RecordBackupStatus;
  error: string | null;
  onGoogleCredential: (idToken: string, nonce: string) => Promise<void>;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
  onOpenAccount: () => void;
}

export function RecordBackupBar(props: RecordBackupBarProps) {
  const busy = props.authPending
    || props.status === 'loading'
    || props.status === 'syncing';

  return (
    <section className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      {props.authenticated ? (
        <div className="ml-auto flex min-w-0 flex-col items-end pt-2">
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <p className="max-w-40 truncate px-1 text-sm font-black text-gray-100 sm:max-w-56 sm:text-base">
              {props.displayName || '내 계정'}
            </p>
            <button
              type="button"
              onClick={props.onOpenAccount}
              className="rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              마이페이지
            </button>
            <button
              type="button"
              onClick={() => void props.onSignOut()}
              disabled={busy}
              className="rounded px-2 py-1 text-xs font-bold text-gray-500 transition hover:bg-white/5 hover:text-gray-200 disabled:opacity-50"
            >
              로그아웃
            </button>
          </div>
          {props.status === 'error' ? (
            <button
              type="button"
              onClick={props.onRetry}
              disabled={busy}
              title={props.error ?? undefined}
              className="mt-1 rounded px-2 py-1 text-[11px] font-bold text-red-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
            >
              기록 저장 실패 · 다시 시도
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ml-auto flex min-w-0 flex-col items-end pt-2 text-right">
          <GoogleSignInButton
            disabled={!props.authReady || props.authPending}
            onCredential={props.onGoogleCredential}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            계정에 카드깡 기록을 저장할 수 있어요.
          </p>
          <p className="mt-1 text-[10px] text-gray-600">
            계속하면 <Link href="/terms" className="underline underline-offset-2 hover:text-gray-400">이용약관</Link>과{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-400">개인정보처리방침</Link>에 동의하게 됩니다.
          </p>
          {props.error ? <p className="mt-1 text-[11px] text-red-300">{props.error}</p> : null}
        </div>
      )}
    </section>
  );
}
