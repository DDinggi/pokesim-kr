'use client';

import { useState, type ReactNode } from 'react';

export function AccountScreen({
  email,
  displayName,
  authPending,
  authError,
  onBackToMain,
  onSaveDisplayName,
  onDeleteAccount,
  accountBar,
}: {
  email: string;
  displayName: string;
  authPending: boolean;
  authError: string | null;
  onBackToMain: () => void;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  accountBar?: ReactNode;
}) {
  const [nickname, setNickname] = useState(displayName);
  const [savePending, setSavePending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  const handleSave = async () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      setSaveMessage('닉네임을 입력해주세요.');
      return;
    }

    setSavePending(true);
    setSaveMessage(null);
    try {
      await onSaveDisplayName(nextNickname);
      setNickname(nextNickname);
      setSaveMessage('닉네임을 저장했습니다.');
    } catch {
      setSaveMessage('닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavePending(false);
    }
  };

  const handleDelete = async () => {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
      setDeleteOpen(false);
    } catch {
      setDeleteError('계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
          <button
            type="button"
            onClick={onBackToMain}
            className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
          >
            ← 메인
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">마이페이지</h1>
            <p className="mt-1 truncate text-xs text-gray-500">계정 정보 관리</p>
          </div>
        </div>
          {accountBar ? <div className="w-full sm:ml-auto sm:w-auto">{accountBar}</div> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <section className="border-b border-gray-800 pb-8">
          <h2 className="text-sm font-black text-gray-200">로그인 정보</h2>
          <dl className="mt-5 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
            <dt className="text-xs font-bold text-gray-500">Google 아이디</dt>
            <dd className="min-w-0 break-all text-sm text-gray-200">{email}</dd>
          </dl>
        </section>

        <section className="border-b border-gray-800 py-8">
          <h2 className="text-sm font-black text-gray-200">닉네임</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setSaveMessage(null);
              }}
              maxLength={20}
              autoComplete="nickname"
              className="h-11 min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-400"
              placeholder="닉네임"
              aria-label="닉네임"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={authPending || savePending || nickname.trim() === displayName.trim()}
              className="h-11 rounded-md bg-cyan-300 px-5 text-sm font-black text-gray-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savePending ? '저장 중' : '저장'}
            </button>
          </div>
          {saveMessage ? (
            <p className={`mt-2 text-xs ${saveMessage.includes('저장했습니다') ? 'text-cyan-300' : 'text-red-300'}`}>
              {saveMessage}
            </p>
          ) : null}
        </section>

        <section className="pt-8">
          <h2 className="text-sm font-black text-gray-200">계정 탈퇴</h2>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            PokéSim KR 계정과 계정에 저장한 누적 운·힛카드 기록이 삭제됩니다.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            disabled={authPending}
            className="mt-4 rounded-md border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 hover:border-red-400/60 disabled:opacity-50"
          >
            계정 탈퇴
          </button>
          {authError ? <p className="mt-3 text-xs text-red-300">{authError}</p> : null}
        </section>
      </main>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (!deletePending) setDeleteOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-lg bg-gray-950 p-5 shadow-2xl ring-1 ring-red-300/25"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-account-title" className="text-lg font-black text-white">
              pokesim.kr 계정을 삭제할까요?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              계정과 계정에 저장된 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            {deleteError || authError ? (
              <p className="mt-3 text-xs text-red-300">{deleteError ?? authError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deletePending}
                className="rounded-md px-3 py-2 text-sm font-bold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletePending}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deletePending ? '삭제 중' : '계정 탈퇴'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}