import type { GlobalStats, VisitorStats } from '../lib/statsTracker';

interface SiteStatsProps {
  stats: GlobalStats | null;
  visitorStats: VisitorStats | null;
}

export default function SiteStats({ stats, visitorStats }: SiteStatsProps) {
  const metrics = [
    { label: '방문', description: '누적 방문 · 한국 시간 기준 브라우저당 하루 1회', value: visitorStats?.cumulativeVisits, unit: '회' },
    { label: '박스 개봉', description: '누적 박스 개봉', value: stats?.totalBoxes, unit: '' },
    { label: '팩 개봉', description: '누적 팩 개봉 · 박스에 포함된 팩 포함', value: stats?.totalPacks, unit: '' },
  ];

  return (
    <section aria-label="서비스 누적 기록" className="mb-4 w-full max-w-xl">
      <dl className="grid grid-cols-3 divide-x divide-gray-800/70 py-2 text-center">
        {metrics.map(({ label, description, value, unit }) => (
          <div key={label} title={description} className="flex min-w-0 flex-col">
            <dt className="order-2 mt-1.5 text-[11px] text-gray-500 sm:text-xs">{label}<span className="sr-only"> · {description}</span></dt>
            <dd className="whitespace-nowrap text-base font-semibold tracking-tight text-gray-200 tabular-nums min-[375px]:text-lg sm:text-2xl">
              {value == null ? <span aria-label="통계 확인 중 또는 조회 불가">—</span> : (
                <>{value.toLocaleString('ko-KR')}{unit && <span className="ml-0.5 text-[11px] font-normal text-gray-500 sm:ml-1 sm:text-sm">{unit}</span>}</>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
