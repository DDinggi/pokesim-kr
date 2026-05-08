'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { SetMeta } from '../lib/types';

const SET_THEMES: Record<string, { gradient: string; accent: string }> = {
  'm4-ninja-spinner': {
    gradient: 'from-cyan-700 via-blue-800 to-indigo-900',
    accent: 'text-cyan-300',
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
};

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

  return (
    <button
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl text-left transition-transform hover:scale-[1.02] active:scale-[0.99] shadow-xl ring-1 ring-white/10 bg-gradient-to-br ${theme.gradient}`}
    >
      {/* 박스 제품 이미지 (or fallback gradient block) */}
      <div className="relative aspect-[4/5] w-full bg-black/30 overflow-hidden">
        {showImage ? (
          <Image
            src={`/boxes/${set.code}.png`}
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
            {set.type === 'hi-class' ? '하이클래스팩' : '확장팩'}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black/40 backdrop-blur ${theme.accent}`}>
            {set.box_size}팩 × {set.pack_size}장
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
}: {
  sets: SetMeta[];
  onSelect: (set: SetMeta) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80">
        <Link href="/" className="text-2xl font-bold tracking-tight hover:text-gray-300 transition-colors">
          PokéSim KR
        </Link>
        <p className="text-xs text-gray-500 mt-1">한국 포켓몬 TCG 박스깡 시뮬레이터</p>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sets.map((s) => {
            const theme = SET_THEMES[s.code] ?? {
              gradient: 'from-gray-700 to-gray-900',
              accent: 'text-gray-300',
              subtitle: '',
            };
            return <SetCard key={s.code} set={s} theme={theme} onSelect={() => onSelect(s)} />;
          })}
        </div>
      </main>

      <footer className="px-6 py-4 text-[10px] text-gray-600 text-center border-t border-gray-900">
        ⓘ 봉입률은 추정치 · 포켓몬코리아는 확정 봉입을 안내하지 않습니다
      </footer>
    </div>
  );
}
