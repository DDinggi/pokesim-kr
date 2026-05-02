'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Card, SetMeta, BoxResult } from '../lib/types';
import { simulateBox, PROBABILITY_META } from '../lib/simulator';

const CDN_BASE = 'https://cards.image.pokemonkorea.co.kr/data/';

const RARITY_ORDER = ['SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C'];

const RARITY_BADGE: Record<string, string> = {
  C: 'bg-gray-500 text-white',
  U: 'bg-blue-500 text-white',
  R: 'bg-purple-500 text-white',
  RR: 'bg-amber-400 text-gray-900',
  AR: 'bg-cyan-400 text-gray-900',
  SR: 'bg-orange-400 text-gray-900',
  SAR: 'bg-pink-400 text-gray-900',
  UR: 'bg-red-500 text-white',
};

const CARD_GLOW: Record<string, string> = {
  RR: 'ring-1 ring-amber-400/60',
  AR: 'ring-1 ring-cyan-400/60',
  SR: 'ring-2 ring-orange-400/70',
  SAR: 'ring-2 ring-pink-400 shadow-lg shadow-pink-500/40',
  UR: 'ring-2 ring-red-400',
};

const RARE_SET = new Set(['RR', 'AR', 'SR', 'SAR', 'UR']);

const AUTO_MS = 400;

type Phase = 'idle' | 'revealing' | 'done';

function CardTile({ card, size }: { card: Card; size: 'sm' | 'md' | 'lg' }) {
  const glow = card.rarity ? (CARD_GLOW[card.rarity] ?? '') : '';
  return (
    <div className={`relative rounded-lg overflow-hidden ${glow}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${CDN_BASE}${card.image_url}`}
        alt={card.name_ko ?? card.card_num}
        className="w-full rounded-lg"
        loading="lazy"
      />
      {size !== 'sm' && card.rarity && (
        <span
          className={`absolute bottom-1 right-1 text-[9px] font-bold px-1 rounded ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}
        >
          {card.rarity}
        </span>
      )}
    </div>
  );
}

function IdleScreen({ meta, onStart }: { meta: SetMeta; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 gap-8">
      <div className="text-center">
        <p className="text-2xl font-bold mb-2">{meta.name_ko}</p>
        <p className="text-gray-400 text-sm">
          {meta.cards.length}종 · {meta.box_size}팩 · {meta.pack_size}장/팩
        </p>
      </div>

      <button
        onClick={onStart}
        className="w-64 py-5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 transition font-bold text-lg shadow-lg shadow-red-900/30"
      >
        박스 깡하기
        <span className="block text-sm font-normal text-red-200 mt-1">
          {meta.box_price_krw.toLocaleString()}원
        </span>
      </button>

      <p className="text-[11px] text-gray-600 text-center max-w-xs leading-relaxed">
        ⓘ {PROBABILITY_META.disclaimer}
        <br />
        출처: {PROBABILITY_META.source}
      </p>
    </div>
  );
}

function RevealScreen({
  result,
  packIdx,
  onNext,
  onSkip,
}: {
  result: BoxResult;
  packIdx: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const pack = result.packs[packIdx];
  const total = result.packs.length;
  const progress = ((packIdx + 1) / total) * 100;
  const isLast = packIdx + 1 >= total;

  const hitCard = pack.cards[pack.cards.length - 1];
  const isRareHit = hitCard?.rarity ? RARE_SET.has(hitCard.rarity) : false;

  return (
    <div
      className="flex flex-col items-center gap-4 px-4 py-6 min-h-[calc(100vh-65px)] cursor-pointer select-none"
      onClick={onNext}
    >
      <div className="text-center pointer-events-none">
        <p className="text-xl font-bold tabular-nums">
          {packIdx + 1} / {total} 팩
        </p>
        <div className="mt-2 w-56 h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-red-500 rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isRareHit ? (
        <p className="text-sm font-semibold text-amber-300 animate-pulse h-5">
          ✨ {hitCard.rarity} 당첨!
        </p>
      ) : (
        <p className="h-5" />
      )}

      <div className="grid grid-cols-5 gap-3 w-full max-w-3xl mx-auto pointer-events-none">
        {pack.cards.map((card, i) => (
          <CardTile key={i} card={card} size="lg" />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 mt-auto pt-2">
        <p className="text-xs text-gray-500">화면 클릭 · 스페이스바로 빠르게</p>
        <button
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          전체 결과 바로 보기 →
        </button>
        {isLast && (
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="px-8 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-sm"
          >
            결과 보기 →
          </button>
        )}
      </div>
    </div>
  );
}

function DoneScreen({
  result,
  meta,
  onRedo,
}: {
  result: BoxResult;
  meta: SetMeta;
  onRedo: () => void;
}) {
  const allCards = result.packs.flatMap((p) => p.cards);

  const sorted = [...allCards].sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity ?? '');
    const bi = RARITY_ORDER.indexOf(b.rarity ?? '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const rares = sorted.filter((c) => c.rarity && RARE_SET.has(c.rarity));
  const summary = result.summary;

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h2 className="text-2xl font-bold">박스깡 완료!</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          {meta.box_price_krw.toLocaleString()}원 지출 · {allCards.length}장
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {RARITY_ORDER.map((r) => {
          const count = summary[r];
          if (!count) return null;
          return (
            <div
              key={r}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${RARITY_BADGE[r] ?? 'bg-gray-600 text-white'}`}
            >
              {r} ×{count}
            </div>
          );
        })}
      </div>

      {rares.length > 0 && (
        <section className="mb-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ✨ 레어 풀 ({rares.length}장)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {rares.map((card, i) => (
              <CardTile key={i} card={card} size="lg" />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          전체 {allCards.length}장
        </h3>
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-1.5">
          {sorted.map((card, i) => (
            <CardTile key={i} card={card} size="sm" />
          ))}
        </div>
      </section>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onRedo}
          className="px-10 py-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold transition"
        >
          다시 깡하기
        </button>
      </div>

      <p className="text-[11px] text-gray-600 text-center mt-6">
        ⓘ {PROBABILITY_META.disclaimer}
      </p>
      <p className="text-[10px] text-gray-700 text-center mt-1 font-mono break-all">
        seed: {result.seed}
      </p>
    </div>
  );
}

export function BoxSimulator({ setMeta }: { setMeta: SetMeta }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [boxResult, setBoxResult] = useState<BoxResult | null>(null);
  const [packIdx, setPackIdx] = useState(0);

  const startBox = useCallback(() => {
    const result = simulateBox(setMeta.cards, setMeta.box_size, setMeta.type, setMeta.pack_size);
    setBoxResult(result);
    setPackIdx(0);
    setPhase('revealing');
  }, [setMeta]);

  const nextPack = useCallback(() => {
    setPackIdx((prev) => {
      const next = prev + 1;
      if (boxResult && next >= boxResult.packs.length) {
        setPhase('done');
        return prev;
      }
      return next;
    });
  }, [boxResult]);

  // Auto-advance: fires AUTO_MS after each pack change
  useEffect(() => {
    if (phase !== 'revealing') return;
    const timer = setTimeout(nextPack, AUTO_MS);
    return () => clearTimeout(timer);
  }, [phase, packIdx, nextPack]);

  // Keyboard: space / arrow right / enter advance immediately
  useEffect(() => {
    if (phase !== 'revealing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        nextPack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, nextPack]);

  const reset = () => {
    setPhase('idle');
    setBoxResult(null);
    setPackIdx(0);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">PokéSim KR</h1>
          <p className="text-xs text-gray-400">{setMeta.name_ko}</p>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← 처음으로
          </button>
        )}
      </header>

      <main className="flex-1">
        {phase === 'idle' && <IdleScreen meta={setMeta} onStart={startBox} />}
        {phase === 'revealing' && boxResult && (
          <RevealScreen
            result={boxResult}
            packIdx={packIdx}
            onNext={nextPack}
            onSkip={() => setPhase('done')}
          />
        )}
        {phase === 'done' && boxResult && (
          <DoneScreen result={boxResult} meta={setMeta} onRedo={startBox} />
        )}
      </main>
    </div>
  );
}
