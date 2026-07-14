import type { GuestRecordSummary } from '../lib/useRecordBackup';

export function RecordMergeDialog({ summary, pending, error, onMerge, onKeepSeparate }: {
  summary: GuestRecordSummary;
  pending: boolean;
  error: string | null;
  onMerge: () => void;
  onKeepSeparate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="record-merge-title" className="w-full max-w-sm rounded-lg border border-white/10 bg-gray-950 p-5 text-white shadow-2xl">
        <h2 id="record-merge-title" className="text-lg font-black">이 브라우저에 개봉 기록이 있어요</h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">지금 로그인한 Google 계정의 기록에 옮길까요?</p>
        <p className="mt-3 text-xs font-bold text-gray-300">
          {summary.boxes.toLocaleString()}박스 · {summary.packs.toLocaleString()}팩
          {summary.uniqueHitCards > 0 ? ` · 힛카드 ${summary.uniqueHitCards.toLocaleString()}종` : ''}
        </p>
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={onMerge} disabled={pending} className="rounded-md bg-red-600 px-4 py-3 text-sm font-black hover:bg-red-500 disabled:opacity-60">
            {pending ? '기록 옮기는 중...' : '계정 기록에 옮기기'}
          </button>
          <button type="button" onClick={onKeepSeparate} disabled={pending} className="rounded-md px-4 py-3 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">따로 두기</button>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-gray-600">서버 저장이 끝난 뒤에만 이 브라우저의 비로그인 기록을 비웁니다.</p>
      </section>
    </div>
  );
}
