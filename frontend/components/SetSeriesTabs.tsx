import type { SetMeta } from '../lib/types';
import {
  getAvailableSetSeries,
  type SetSeriesKey,
} from '../lib/setSeries';

export function SetSeriesTabs({
  sets,
  active,
  onChange,
  tone = 'box',
}: {
  sets: Array<Pick<SetMeta, 'code'>>;
  active: SetSeriesKey;
  onChange: (series: SetSeriesKey) => void;
  tone?: 'box' | 'vending';
}) {
  const seriesList = getAvailableSetSeries(sets);
  const activeClasses = tone === 'vending'
    ? 'bg-yellow-300 text-gray-950 ring-yellow-100'
    : 'bg-cyan-300 text-gray-950 ring-cyan-100';

  return (
    <div className="overflow-x-auto pb-1" aria-label="확장팩 시리즈 선택">
      <div
        role="tablist"
        className="flex min-w-max gap-1 rounded-lg bg-gray-900/90 p-1 ring-1 ring-white/10"
      >
        {seriesList.map((series) => {
          const selected = series.key === active;
          return (
            <button
              key={series.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(series.key)}
              className={`flex min-h-10 min-w-[78px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black ring-1 transition sm:min-w-[132px] ${
                selected
                  ? activeClasses
                  : 'text-gray-400 ring-transparent hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span className="sm:hidden">{series.shortLabel}</span>
              <span className="hidden sm:inline">{series.label}</span>
              <span className={`tabular-nums ${selected ? 'text-gray-700' : 'text-gray-600'}`}>
                {series.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
