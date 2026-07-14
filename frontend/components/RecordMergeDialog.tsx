import type { GuestRecordSummary } from '../lib/useRecordBackup';

export function RecordMergeDialog({ summary, pending, error, onMerge, onKeepSeparate }: {
  summary: GuestRecordSummary;
  pending: boolean;
  error: string | null;
  onMerge: () => void;
  onKeepSeparate: () => void;
}) {
  const summaryLabel = [
    summary.boxes > 0 ? `${summary.boxes.toLocaleString()}박스` : null,
    summary.packs > 0 ? `${summary.packs.toLocaleString()}팩` : null,
    summary.uniqueHitCards > 0
      ? `힛카드 ${summary.uniqueHitCards.toLocaleString()}종`
      : null,
  ].filter(Boolean).join(' · ') || '저장된 기록';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-merge-title"
        aria-describedby="record-merge-description"
        className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-950 p-5 text-white shadow-2xl"
      >
        <h2 id="record-merge-title" className="text-lg font-black">로그인 전 기록도 저장할까요?</h2>
        <p id="record-merge-description" className="mt-2 text-sm leading-6 text-gray-400">
          이 브라우저에서 만든 기록을 지금 계정에 함께 저장할 수 있어요.
        </p>
        <div className="mt-4 flex items-center justify-between gap-4 border-y border-gray-800 py-3">
          <span className="shrink-0 text-xs font-bold text-gray-500">이 브라우저 기록</span>
          <strong className="text-right text-sm text-gray-200">{summaryLabel}</strong>
        </div>
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onMerge}
            disabled={pending}
            className="rounded-md bg-cyan-300 px-4 py-3 text-sm font-black text-gray-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? '저장하는 중...' : '함께 저장하기'}
          </button>
          <button
            type="button"
            onClick={onKeepSeparate}
            disabled={pending}
            className="rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm font-bold text-gray-400 transition hover:border-gray-700 hover:text-white disabled:opacity-50"
          >
            나중에 하기
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-5 text-gray-600">
          함께 저장하면 다른 기기에서도 이어볼 수 있어요.
        </p>
      </section>
    </div>
  );
}
