'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { SetMeta } from '../lib/types';
import { getBoxImageSrc } from '../lib/boxImages';
import { NEW_SIM_SET_NAMES, isNewSimSet } from '../lib/newSets';
import { fetchSetPopularity, type SetPopularity } from '../lib/statsTracker';

const SET_THEMES: Record<string, { gradient: string; accent: string }> = {
  'm-start-deck-100': {
    gradient: 'from-sky-500 via-blue-600 to-indigo-800',
    accent: 'text-sky-200',
  },
  'm4-ninja-spinner': {
    gradient: 'from-cyan-700 via-blue-800 to-indigo-900',
    accent: 'text-cyan-300',
  },
  'm5-abyss-eye': {
    gradient: 'from-fuchsia-900 via-gray-950 to-cyan-950',
    accent: 'text-fuchsia-200',
  },
  'm-nihil-zero': {
    gradient: 'from-emerald-700 via-teal-800 to-slate-900',
    accent: 'text-emerald-300',
  },
  'm-dream-ex': {
    gradient: 'from-amber-700 via-orange-800 to-rose-900',
    accent: 'text-amber-200',
  },
  'm-inferno-x': {
    gradient: 'from-red-700 via-rose-800 to-red-900',
    accent: 'text-red-300',
  },
  'm-mega-brave': {
    gradient: 'from-blue-700 via-sky-800 to-blue-900',
    accent: 'text-blue-300',
  },
  'm-mega-symphonia': {
    gradient: 'from-purple-700 via-fuchsia-800 to-purple-900',
    accent: 'text-purple-300',
  },
  'sv11b-black-bolt': {
    gradient: 'from-gray-900 via-slate-950 to-zinc-950',
    accent: 'text-slate-300',
  },
  'sv11a-white-flare': {
    gradient: 'from-zinc-600 via-slate-600 to-gray-800',
    accent: 'text-white',
  },
  'sv10-glory': {
    gradient: 'from-gray-800 via-red-950 to-slate-900',
    accent: 'text-red-400',
  },
  'sv9a-blazing-arena': {
    gradient: 'from-orange-600 via-red-700 to-rose-900',
    accent: 'text-orange-300',
  },
  'sv9-battle-partners': {
    gradient: 'from-sky-600 via-blue-700 to-indigo-900',
    accent: 'text-sky-300',
  },
  'sv8a-terastal-festa': {
    gradient: 'from-pink-700 via-fuchsia-800 to-purple-900',
    accent: 'text-pink-300',
  },
  'sv8-super-electric': {
    gradient: 'from-yellow-600 via-amber-700 to-orange-900',
    accent: 'text-yellow-300',
  },
  'sv7a-paradise-dragona': {
    gradient: 'from-sky-700 via-indigo-800 to-violet-950',
    accent: 'text-sky-300',
  },
  'sv7-stellar-miracle': {
    gradient: 'from-teal-700 via-cyan-800 to-slate-950',
    accent: 'text-teal-300',
  },
  'sv6a-night-wanderer': {
    gradient: 'from-indigo-800 via-slate-900 to-purple-950',
    accent: 'text-indigo-300',
  },
  'sv6-mask': {
    gradient: 'from-violet-700 via-purple-800 to-indigo-950',
    accent: 'text-violet-300',
  },
  'sv5a-crimson-haze': {
    gradient: 'from-rose-700 via-red-800 to-fuchsia-950',
    accent: 'text-rose-300',
  },
  'sv5m-cyber-judge': {
    gradient: 'from-slate-700 via-cyan-900 to-blue-950',
    accent: 'text-cyan-300',
  },
  'sv5k-wild-force': {
    gradient: 'from-lime-700 via-green-800 to-emerald-950',
    accent: 'text-lime-300',
  },
  'sv4m-future-flash': {
    gradient: 'from-cyan-700 via-slate-800 to-blue-950',
    accent: 'text-cyan-300',
  },
  'sv4k-ancient-roar': {
    gradient: 'from-orange-700 via-emerald-900 to-slate-950',
    accent: 'text-orange-300',
  },
  'sv4a-shiny-treasure-ex': {
    gradient: 'from-amber-500 via-yellow-600 to-orange-800',
    accent: 'text-yellow-200',
  },
  'sv3a-raging-surf': {
    gradient: 'from-blue-700 via-teal-800 to-slate-950',
    accent: 'text-blue-300',
  },
  'sv3-black-flame-ruler': {
    gradient: 'from-zinc-900 via-red-950 to-orange-950',
    accent: 'text-red-300',
  },
  'sv2a-151': {
    gradient: 'from-red-600 via-rose-700 to-red-900',
    accent: 'text-rose-300',
  },
  'sv2p-snow-hazard': {
    gradient: 'from-sky-500 via-cyan-700 to-slate-900',
    accent: 'text-sky-200',
  },
  'sv2d-clay-burst': {
    gradient: 'from-amber-700 via-orange-800 to-stone-900',
    accent: 'text-amber-200',
  },
  'sv1a-triplet': {
    gradient: 'from-emerald-600 via-green-700 to-teal-900',
    accent: 'text-emerald-300',
  },
  'sv1v-violet-ex': {
    gradient: 'from-violet-700 via-indigo-800 to-slate-950',
    accent: 'text-violet-200',
  },
  'sv1s-scarlet-ex': {
    gradient: 'from-red-700 via-rose-800 to-slate-950',
    accent: 'text-red-200',
  },
  's12a-vstar-universe': {
    gradient: 'from-violet-800 via-slate-900 to-amber-950',
    accent: 'text-amber-200',
  },
  's12-paradigm-trigger': {
    gradient: 'from-indigo-700 via-blue-900 to-zinc-950',
    accent: 'text-blue-200',
  },
  's11a-incandescent-arcana': {
    gradient: 'from-sky-700 via-blue-800 to-indigo-950',
    accent: 'text-sky-200',
  },
  's11-lost-abyss': {
    gradient: 'from-fuchsia-800 via-purple-950 to-zinc-950',
    accent: 'text-fuchsia-300',
  },
  's10b-pokemon-go': {
    gradient: 'from-sky-700 via-blue-900 to-lime-900',
    accent: 'text-lime-200',
  },
  's10a-dark-phantasma': {
    gradient: 'from-rose-900 via-slate-950 to-indigo-950',
    accent: 'text-rose-300',
  },
  's10d-time-gazer': {
    gradient: 'from-violet-800 via-slate-900 to-blue-950',
    accent: 'text-blue-200',
  },
  's10p-space-juggler': {
    gradient: 'from-emerald-700 via-teal-900 to-slate-950',
    accent: 'text-emerald-300',
  },
  's9a-battle-region': {
    gradient: 'from-rose-700 via-purple-800 to-cyan-950',
    accent: 'text-rose-200',
  },
  's9-star-birth': {
    gradient: 'from-zinc-800 via-indigo-900 to-amber-900',
    accent: 'text-amber-200',
  },
  's8b-vmax-climax': {
    gradient: 'from-red-700 via-yellow-700 to-emerald-900',
    accent: 'text-yellow-200',
  },
  's8-fusion-arts': {
    gradient: 'from-pink-700 via-sky-800 to-violet-950',
    accent: 'text-pink-200',
  },
  's6k-jet-black-spirit': {
    gradient: 'from-zinc-800 via-slate-900 to-black',
    accent: 'text-zinc-300',
  },
  's5a-matchless-fighters': {
    gradient: 'from-red-800 via-sky-900 to-slate-950',
    accent: 'text-sky-200',
  },
  's5i-single-strike-master': {
    gradient: 'from-red-800 via-rose-900 to-stone-950',
    accent: 'text-red-200',
  },
  's5r-rapid-strike-master': {
    gradient: 'from-sky-700 via-blue-900 to-slate-950',
    accent: 'text-sky-200',
  },
  's3a-legendary-heartbeat': {
    gradient: 'from-emerald-700 via-yellow-800 to-slate-950',
    accent: 'text-yellow-200',
  },
  's3-infinity-zone': {
    gradient: 'from-violet-800 via-red-900 to-slate-950',
    accent: 'text-violet-200',
  },
  's2a-explosive-walker': {
    gradient: 'from-red-700 via-orange-900 to-stone-950',
    accent: 'text-orange-200',
  },
  's2-rebellion-crash': {
    gradient: 'from-fuchsia-800 via-indigo-900 to-slate-950',
    accent: 'text-fuchsia-200',
  },
  's1a-vmax-rising': {
    gradient: 'from-emerald-700 via-lime-800 to-rose-950',
    accent: 'text-lime-200',
  },
  's1w-sword': {
    gradient: 'from-sky-700 via-blue-900 to-slate-950',
    accent: 'text-sky-200',
  },
  's1h-shield': {
    gradient: 'from-rose-700 via-red-900 to-zinc-950',
    accent: 'text-rose-200',
  },
  'sm12a-tag-team-gx-tag-all-stars': {
    gradient: 'from-yellow-600 via-pink-700 to-indigo-950',
    accent: 'text-yellow-200',
  },
  'sm12-alter-genesis': {
    gradient: 'from-indigo-800 via-violet-900 to-amber-950',
    accent: 'text-amber-200',
  },
  'sm11b-dream-league': {
    gradient: 'from-cyan-700 via-fuchsia-800 to-slate-950',
    accent: 'text-cyan-200',
  },
  'sm11a-remix-bout': {
    gradient: 'from-emerald-700 via-red-800 to-blue-950',
    accent: 'text-emerald-200',
  },
  'sm11-miracle-twin': {
    gradient: 'from-fuchsia-700 via-indigo-800 to-slate-950',
    accent: 'text-fuchsia-200',
  },
  'sm8-burst-impact': {
    gradient: 'from-rose-700 via-violet-800 to-slate-950',
    accent: 'text-rose-200',
  },
  'sm7a-plasma-spark': {
    gradient: 'from-yellow-500 via-sky-700 to-zinc-950',
    accent: 'text-yellow-200',
  },
  'sm4plus-gx-battle-boost-remaster': {
    gradient: 'from-emerald-700 via-amber-800 to-slate-950',
    accent: 'text-emerald-200',
  },
  'sm9-tag-bolt': {
    gradient: 'from-yellow-600 via-cyan-800 to-zinc-950',
    accent: 'text-yellow-200',
  },
  'sm8a-dark-order': {
    gradient: 'from-gray-950 via-red-950 to-amber-950',
    accent: 'text-amber-200',
  },
  'sm9b-full-metal-wall': {
    gradient: 'from-zinc-700 via-amber-900 to-gray-950',
    accent: 'text-yellow-200',
  },
  'sm9a-night-unison': {
    gradient: 'from-violet-900 via-rose-950 to-gray-950',
    accent: 'text-pink-200',
  },
  'sm10b-sky-legend': {
    gradient: 'from-sky-700 via-amber-700 to-slate-950',
    accent: 'text-sky-200',
  },
  'sm10a-gg-end': {
    gradient: 'from-zinc-800 via-red-900 to-violet-950',
    accent: 'text-red-200',
  },
  'sm10-double-blaze': {
    gradient: 'from-red-700 via-yellow-700 to-zinc-950',
    accent: 'text-yellow-200',
  },
  'sm8b-gx-ultra-shiny': {
    gradient: 'from-slate-900 via-violet-900 to-cyan-950',
    accent: 'text-cyan-200',
  },
};

const SEARCH_PANEL_LIMIT = 10;

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s·._-]+/g, '');
}

function matchSet(set: SetMeta, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return (
    normalizeSearchText(set.name_ko).includes(q)
    || normalizeSearchText(set.code).includes(q)
    || normalizeSearchText(set.type).includes(q)
  );
}

function getPopularityScore(popularity: SetPopularity | undefined): number {
  if (!popularity) return 0;
  return popularity.totalBoxes * 1_000_000 + popularity.totalPacks * 1_000 + popularity.totalSessions;
}

function sortSetsByPopularity(
  sets: SetMeta[],
  popularityByCode: Map<string, SetPopularity>,
  originalRankByCode: Map<string, number>,
): SetMeta[] {
  return [...sets].sort((a, b) => {
    const scoreDiff = getPopularityScore(popularityByCode.get(b.code))
      - getPopularityScore(popularityByCode.get(a.code));
    if (scoreDiff !== 0) return scoreDiff;
    return (originalRankByCode.get(a.code) ?? 0) - (originalRankByCode.get(b.code) ?? 0);
  });
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function PopularityList({
  sets,
  onSelect,
  title,
  emptyLabel,
  isLoading = false,
}: {
  sets: SetMeta[];
  onSelect: (set: SetMeta) => void;
  title: string;
  emptyLabel: string;
  isLoading?: boolean;
}) {
  return (
    <div id="box-search-results" className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-gray-950/98 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-xs font-black tracking-widest text-gray-400">{title}</p>
      </div>
      {isLoading ? (
        <p className="px-4 py-5 text-center text-sm text-gray-500">인기 순위 불러오는 중...</p>
      ) : sets.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ol className="max-h-[360px] overflow-y-auto py-1">
          {sets.slice(0, SEARCH_PANEL_LIMIT).map((set, index) => {
            return (
              <li key={set.code}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(set)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/10 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded bg-black/30">
                    <Image
                      src={getBoxImageSrc(set.code)}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{set.name_ko}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function SetCard({
  set,
  theme,
  onSelect,
}: {
  set: SetMeta;
  theme: { gradient: string; accent: string };
  onSelect: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const showImage = !imgError;
  const isNew = isNewSimSet(set.code);

  return (
    <button
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl text-left transition-transform hover:scale-[1.02] active:scale-[0.99] shadow-xl ring-1 ring-white/10 bg-gradient-to-br ${theme.gradient}`}
    >
      {/* 박스 제품 이미지 (or fallback gradient block) */}
      <div className="relative aspect-[4/5] w-full bg-black/30 overflow-hidden">
        {showImage ? (
          <Image
            src={getBoxImageSrc(set.code)}
            alt={set.name_ko}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${theme.gradient}`}
          >
            <span className="text-3xl font-black text-white/80 px-4 text-center leading-tight">
              {set.name_ko}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-black/40 backdrop-blur text-white/90">
            {set.type === 'hi-class' ? '하이클래스팩' : set.type === 'starter' ? '스타트덱' : '확장팩'}
          </span>
        </div>
        {isNew && (
          <div className="absolute top-10 left-3">
            <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded bg-yellow-300 text-gray-950 shadow">
              NEW
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black/40 backdrop-blur ${theme.accent}`}>
            {set.type === 'starter' ? '100덱 중 1개' : `${set.box_size}팩 × ${set.pack_size}장`}
          </span>
        </div>
      </div>

      {/* 메타 정보 */}
      <div className="p-4 bg-gray-950/70 backdrop-blur">
        <h2 className="text-lg font-black leading-tight">{set.name_ko}</h2>
        <div className="flex items-end justify-between mt-3 pt-3 border-t border-white/5">
          <div>
            <p className="text-[9px] uppercase text-white/40 tracking-wider">박스 가격</p>
            <p className="text-xl font-bold tabular-nums">
              ₩{set.box_price_krw.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase text-white/40 tracking-wider">카드 풀</p>
            <p className="text-sm font-bold tabular-nums">{set.cards.length}종</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export function SetPicker({
  sets,
  onSelect,
  onBackToMain,
}: {
  sets: SetMeta[];
  onSelect: (set: SetMeta) => void;
  onBackToMain: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [popularity, setPopularity] = useState<SetPopularity[]>([]);
  const [popularityLoaded, setPopularityLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSetPopularity().then((result) => {
      if (cancelled) return;
      setPopularity(result);
      setPopularityLoaded(true);
    }).catch(() => {
      if (!cancelled) setPopularityLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const originalRankByCode = useMemo(
    () => new Map(sets.map((set, index) => [set.code, index])),
    [sets],
  );
  const popularityByCode = useMemo(
    () => new Map(popularity.map((row) => [row.setCode, row])),
    [popularity],
  );
  const popularSets = useMemo(
    () =>
      sortSetsByPopularity(
        sets.filter((set) => getPopularityScore(popularityByCode.get(set.code)) > 0),
        popularityByCode,
        originalRankByCode,
      ),
    [originalRankByCode, popularityByCode, sets],
  );
  const filteredSets = useMemo(
    () => sets.filter((set) => matchSet(set, query)),
    [query, sets],
  );
  const searchResultSets = useMemo(
    () => sortSetsByPopularity(filteredSets, popularityByCode, originalRankByCode),
    [filteredSets, originalRankByCode, popularityByCode],
  );
  const isSearching = query.trim().length > 0;
  const panelSets = isSearching ? searchResultSets : popularSets;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80 flex items-center gap-4">
        <button
          onClick={onBackToMain}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          ← 메인
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">박스깡</h1>
          <p className="text-xs text-gray-500 mt-1">박스를 골라 통째로 까기</p>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
        <div className="mb-5 rounded-lg bg-gray-900/80 ring-1 ring-white/10 px-4 py-3">
          <p className="text-[11px] font-black tracking-widest text-yellow-300">NEW · 2026-07-11</p>
          <p className="text-sm font-bold text-white mt-0.5">
            신규 세트 박스깡 · 박스 업데이트
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {NEW_SIM_SET_NAMES.join(' · ')}
          </p>
        </div>

        <div className="relative mb-5">
          <label className="sr-only" htmlFor="box-search">
            박스 검색
          </label>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            id="box-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchOpen(false);
                event.currentTarget.blur();
              }
            }}
            placeholder="박스 이름 검색"
            className="h-14 w-full rounded-xl border border-white/10 bg-gray-900/80 pl-12 pr-24 text-base font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-300/60 focus:bg-gray-900"
            autoComplete="off"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setSearchOpen((open) => !open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-gray-300 transition hover:bg-white/15 hover:text-white"
          >
            인기순위
          </button>
          {searchOpen && (
            <PopularityList
              sets={panelSets}
              onSelect={onSelect}
              title={isSearching ? '검색 결과' : '인기순위'}
              emptyLabel={isSearching ? '검색 결과가 없습니다' : '아직 인기 순위 데이터가 없습니다'}
              isLoading={!isSearching && !popularityLoaded}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSets.map((s) => {
            const theme = SET_THEMES[s.code] ?? {
              gradient: 'from-gray-700 to-gray-900',
              accent: 'text-gray-300',
            };
            return <SetCard key={s.code} set={s} theme={theme} onSelect={() => onSelect(s)} />;
          })}
        </div>
        {filteredSets.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/15 px-4 py-10 text-center">
            <p className="text-sm font-bold text-gray-400">검색 결과가 없습니다</p>
          </div>
        )}
      </main>
    </div>
  );
}
