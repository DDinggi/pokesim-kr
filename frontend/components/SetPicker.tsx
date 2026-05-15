'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { SetMeta } from '../lib/types';
import { getBoxImageSrc } from '../lib/boxImages';
import { NEW_SIM_SET_NAMES, isNewSimSet } from '../lib/newSets';

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
  'sv4a-shiny-treasure-ex': {
    gradient: 'from-amber-500 via-yellow-600 to-orange-800',
    accent: 'text-yellow-200',
  },
  'sv2a-151': {
    gradient: 'from-red-600 via-rose-700 to-red-900',
    accent: 'text-rose-300',
  },
  'sv1a-triplet': {
    gradient: 'from-emerald-600 via-green-700 to-teal-900',
    accent: 'text-emerald-300',
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
            {set.type === 'hi-class' ? '하이클래스팩' : '확장팩'}
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
  onBackToMain,
}: {
  sets: SetMeta[];
  onSelect: (set: SetMeta) => void;
  onBackToMain: () => void;
}) {
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
          <p className="text-[11px] font-black tracking-widest text-yellow-300">NEW · 2026-05-15</p>
          <p className="text-sm font-bold text-white mt-0.5">
            구작 SV 5종 박스깡 추가
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {NEW_SIM_SET_NAMES.join(' · ')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sets.map((s) => {
            const theme = SET_THEMES[s.code] ?? {
              gradient: 'from-gray-700 to-gray-900',
              accent: 'text-gray-300',
            };
            return <SetCard key={s.code} set={s} theme={theme} onSelect={() => onSelect(s)} />;
          })}
        </div>
      </main>
    </div>
  );
}
