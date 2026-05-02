'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Card, SetMeta, BoxResult, PackResult } from '../lib/types';
import { simulateBox, simulatePack, PROBABILITY_META } from '../lib/simulator';

const CDN_BASE = 'https://cards.image.pokemonkorea.co.kr/data/';

const RARITY_ORDER = ['UR', 'SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C'];

const RARITY_BADGE: Record<string, string> = {
  C: 'bg-gray-500 text-white',
  U: 'bg-blue-500 text-white',
  R: 'bg-purple-500 text-white',
  RR: 'bg-amber-400 text-gray-900',
  AR: 'bg-cyan-400 text-gray-900',
  SR: 'bg-orange-400 text-gray-900',
  SAR: 'bg-pink-400 text-gray-900',
  UR: 'bg-yellow-300 text-gray-900',
};

const CARD_GLOW: Record<string, string> = {
  RR: 'ring-1 ring-amber-400/60',
  AR: 'ring-1 ring-cyan-400/60',
  SR: 'ring-2 ring-orange-400/70',
  SAR: 'ring-2 ring-pink-400 shadow-lg shadow-pink-500/40',
  UR: 'ring-2 ring-yellow-300 shadow-lg shadow-yellow-400/50',
};

const RARE_SET = new Set(['RR', 'AR', 'SR', 'SAR', 'UR']);
const AUTO_MS = 400;

type Mode = 'box-auto' | 'box-manual' | 'box-instant' | 'pack';
type Phase = 'idle' | 'reveal' | 'done';

function resolveImageUrl(image_url: string): string {
  return /^https?:\/\//.test(image_url) ? image_url : `${CDN_BASE}${image_url}`;
}

function CardTile({ card, size = 'md' }: { card: Card; size?: 'sm' | 'md' | 'lg' }) {
  const glow = card.rarity ? (CARD_GLOW[card.rarity] ?? '') : '';
  const [errored, setErrored] = useState(false);
  return (
    <div className={`relative rounded-lg overflow-hidden ${glow}`}>
      {errored || !card.image_url ? (
        <div className="aspect-[5/7] bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-2 text-center">
          <span className="text-[10px] text-gray-400 leading-tight">
            {card.name_ko ?? card.card_num}
          </span>
          {card.rarity && (
            <span className="text-[9px] text-gray-500 mt-1">{card.rarity}</span>
          )}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveImageUrl(card.image_url)}
          alt={card.name_ko ?? card.card_num}
          className="w-full rounded-lg"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      )}
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

function RareHistory({
  result,
  upToPackIdx,
}: {
  result: BoxResult;
  upToPackIdx: number; // exclusive: shows cards from packs [0, upToPackIdx)
}) {
  const seen = result.packs.slice(0, upToPackIdx).flatMap((p) => p.cards);
  const rares = seen.filter((c) => c.rarity && RARE_SET.has(c.rarity));
  if (rares.length === 0 && upToPackIdx === 0) return null;
  return (
    <div className="w-full max-w-3xl mx-auto px-2 mt-4">
      <p className="text-[11px] text-gray-500 mb-1.5 tracking-wide">
        지금까지 {upToPackIdx}팩 깠음 · 레어 {rares.length}장
      </p>
      {rares.length > 0 ? (
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5">
          {rares.map((c, i) => (
            <CardTile key={i} card={c} size="sm" />
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-700">아직 RR 이상 카드 없음</p>
      )}
    </div>
  );
}

function CardBack() {
  return (
    <div className="aspect-[5/7] rounded-lg bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 flex items-center justify-center shadow-md ring-1 ring-white/10">
      <span className="text-white/40 text-3xl font-black select-none">?</span>
    </div>
  );
}

function FlippableCard({
  card,
  flipped,
  onClick,
}: {
  card: Card;
  flipped: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={flipped}
      className={`block w-full transition-transform ${!flipped ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
    >
      {flipped ? <CardTile card={card} size="lg" /> : <CardBack />}
    </button>
  );
}

function IdleScreen({
  meta,
  onStartBox,
  onStartPack,
}: {
  meta: SetMeta;
  onStartBox: (mode: 'box-auto' | 'box-manual' | 'box-instant') => void;
  onStartPack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-2xl font-bold mb-2">{meta.name_ko}</p>
        <p className="text-gray-400 text-sm">
          {meta.cards.length}종 · {meta.box_size}팩 · {meta.pack_size}장/팩
        </p>
      </div>

      <section className="w-full max-w-md">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          박스깡 — {meta.box_price_krw.toLocaleString()}원
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onStartBox('box-auto')}
            className="py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 transition font-bold text-sm shadow-lg shadow-red-900/30 flex flex-col"
          >
            자동
            <span className="text-[10px] font-normal text-red-200 mt-0.5">
              한 팩씩 자동
            </span>
          </button>
          <button
            onClick={() => onStartBox('box-manual')}
            className="py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 transition font-bold text-sm shadow-lg shadow-red-900/30 flex flex-col"
          >
            수동
            <span className="text-[10px] font-normal text-red-200 mt-0.5">
              한 장씩 클릭
            </span>
          </button>
          <button
            onClick={() => onStartBox('box-instant')}
            className="py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 transition font-bold text-sm shadow-lg shadow-red-900/30 flex flex-col"
          >
            즉시
            <span className="text-[10px] font-normal text-red-200 mt-0.5">
              결과 바로
            </span>
          </button>
        </div>
      </section>

      <section className="w-full max-w-md">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          자판기 — 1팩 {meta.pack_price_krw.toLocaleString()}원
        </h3>
        <button
          onClick={onStartPack}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition font-bold text-sm shadow-lg shadow-blue-900/30 flex flex-col"
        >
          1팩 뽑기
          <span className="text-[10px] font-normal text-blue-200 mt-0.5">
            박스 보장 없이 순수 확률
          </span>
        </button>
      </section>

      <p className="text-[11px] text-gray-600 text-center max-w-xs leading-relaxed mt-2">
        ⓘ {PROBABILITY_META.disclaimer}
        <br />
        출처: {PROBABILITY_META.source}
      </p>
    </div>
  );
}

function AutoBoxReveal({
  result,
  packIdx,
  onAdvance,
  onSkip,
}: {
  result: BoxResult;
  packIdx: number;
  onAdvance: () => void;
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
      onClick={onAdvance}
    >
      <div className="text-center pointer-events-none">
        <p className="text-xl font-bold tabular-nums">
          {packIdx + 1} / {total} 팩
        </p>
        <div className="mt-2 w-56 h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-red-500 rounded-full"
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

      <RareHistory result={result} upToPackIdx={packIdx} />

      <div className="flex flex-col items-center gap-3 mt-auto pt-2">
        <p className="text-xs text-gray-500">화면 클릭 · 스페이스바로 빠르게</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSkip();
          }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          전체 결과 바로 보기 →
        </button>
        {isLast && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            className="px-8 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-sm"
          >
            결과 보기 →
          </button>
        )}
      </div>
    </div>
  );
}

function ManualBoxReveal({
  result,
  packIdx,
  flippedSet,
  onFlip,
  onAdvance,
  onSkip,
}: {
  result: BoxResult;
  packIdx: number;
  flippedSet: Set<number>;
  onFlip: (i: number) => void;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const pack = result.packs[packIdx];
  const total = result.packs.length;
  const progress = ((packIdx + 1) / total) * 100;
  const isLast = packIdx + 1 >= total;
  const allFlipped = flippedSet.size === pack.cards.length;
  const cols = pack.cards.length === 10 ? 'grid-cols-5' : 'grid-cols-5';
  const remaining = pack.cards.length - flippedSet.size;
  const nextIdx = allFlipped ? -1 : pack.cards.findIndex((_, i) => !flippedSet.has(i));

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 min-h-[calc(100vh-65px)] select-none">
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">
          {packIdx + 1} / {total} 팩
        </p>
        <div className="mt-2 w-56 h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 깐 카드들 그리드 — 안 깐 자리는 빈 점선 슬롯 */}
      <div className={`grid ${cols} gap-3 w-full max-w-3xl mx-auto`}>
        {pack.cards.map((card, i) =>
          flippedSet.has(i) ? (
            <CardTile key={i} card={card} size="lg" />
          ) : (
            <div
              key={i}
              className="aspect-[5/7] rounded-lg border-2 border-dashed border-gray-800/70 bg-gray-900/30"
            />
          ),
        )}
      </div>

      {/* 가운데 큰 뒷면 카드 (한 자리만 클릭 — 촥촥촥) */}
      {!allFlipped && nextIdx !== -1 && (
        <button
          onClick={() => onFlip(nextIdx)}
          className="w-36 sm:w-44 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        >
          <CardBack />
          <p className="text-xs text-gray-400 mt-2 text-center">
            남은 {remaining}장 · 클릭해서 까기
          </p>
        </button>
      )}
      {allFlipped && (
        <p className="text-sm text-gray-400 h-[180px] flex items-center">
          카드 모두 확인됨
        </p>
      )}

      <RareHistory result={result} upToPackIdx={packIdx} />

      <div className="flex flex-col items-center gap-3 mt-auto pt-2">
        <button
          onClick={onAdvance}
          disabled={!allFlipped}
          className={`px-8 py-2 rounded-xl font-bold text-sm transition ${
            allFlipped
              ? 'bg-red-600 hover:bg-red-500 active:scale-95'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLast ? '결과 보기 →' : '다음 팩 →'}
        </button>
        <button
          onClick={onSkip}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          전체 결과 바로 보기 →
        </button>
        <p className="text-[10px] text-gray-600">스페이스바/엔터 = 다음 카드</p>
      </div>
    </div>
  );
}

function BoxDoneScreen({
  result,
  meta,
  onRedo,
  onHome,
}: {
  result: BoxResult;
  meta: SetMeta;
  onRedo: () => void;
  onHome: () => void;
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

      <div className="mt-8 flex justify-center gap-3">
        <button
          onClick={onHome}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 rounded-xl font-bold transition"
        >
          처음으로
        </button>
        <button
          onClick={onRedo}
          className="px-10 py-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold transition"
        >
          다시 깡하기
        </button>
      </div>

      <p className="text-[11px] text-gray-600 text-center mt-6">ⓘ {PROBABILITY_META.disclaimer}</p>
      <p className="text-[10px] text-gray-700 text-center mt-1 font-mono break-all">
        seed: {result.seed}
      </p>
    </div>
  );
}

function PackDoneScreen({
  pack,
  seed,
  meta,
  onRedo,
  onHome,
}: {
  pack: PackResult;
  seed: string;
  meta: SetMeta;
  onRedo: () => void;
  onHome: () => void;
}) {
  const hitCard = pack.cards[pack.cards.length - 1];
  const isRareHit = hitCard?.rarity ? RARE_SET.has(hitCard.rarity) : false;
  const cols = pack.cards.length === 10 ? 'grid-cols-5' : 'grid-cols-5';

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto flex flex-col items-center gap-6 min-h-[calc(100vh-65px)]">
      <div className="text-center">
        <h2 className="text-2xl font-bold">자판기 1팩</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          {meta.pack_price_krw.toLocaleString()}원 · {pack.cards.length}장
        </p>
      </div>

      {isRareHit && (
        <p className="text-sm font-semibold text-amber-300 animate-pulse">
          ✨ {hitCard.rarity} 당첨!
        </p>
      )}

      <div className={`grid ${cols} gap-3 w-full`}>
        {pack.cards.map((card, i) => (
          <CardTile key={i} card={card} size="lg" />
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-auto">
        <button
          onClick={onHome}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 rounded-xl font-bold transition"
        >
          처음으로
        </button>
        <button
          onClick={onRedo}
          className="px-10 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl font-bold transition"
        >
          1팩 더 뽑기
        </button>
      </div>

      <p className="text-[11px] text-gray-600 text-center">
        ⓘ 자판기 모드는 박스 보장룰 무시, 가중치만 적용 (D-128)
      </p>
      <p className="text-[10px] text-gray-700 text-center font-mono break-all">seed: {seed}</p>
    </div>
  );
}

export function BoxSimulator({ setMeta }: { setMeta: SetMeta }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode | null>(null);
  const [boxResult, setBoxResult] = useState<BoxResult | null>(null);
  const [packResult, setPackResult] = useState<{ pack: PackResult; seed: string } | null>(null);
  const [packIdx, setPackIdx] = useState(0);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());

  const startBox = useCallback(
    (m: 'box-auto' | 'box-manual' | 'box-instant') => {
      const result = simulateBox(setMeta.cards, setMeta.box_size, setMeta.type, setMeta.pack_size);
      setBoxResult(result);
      setMode(m);
      setPackIdx(0);
      setFlippedSet(new Set());
      setPhase(m === 'box-instant' ? 'done' : 'reveal');
    },
    [setMeta],
  );

  const startPack = useCallback(() => {
    const result = simulatePack(setMeta.cards, setMeta.type, setMeta.pack_size);
    setPackResult(result);
    setMode('pack');
    setPhase('done');
  }, [setMeta]);

  const advancePack = useCallback(() => {
    if (!boxResult) return;
    setPackIdx((prev) => {
      const next = prev + 1;
      if (next >= boxResult.packs.length) {
        setPhase('done');
        return prev;
      }
      setFlippedSet(new Set());
      return next;
    });
  }, [boxResult]);

  const flipCard = useCallback((i: number) => {
    setFlippedSet((s) => {
      if (s.has(i)) return s;
      const next = new Set(s);
      next.add(i);
      return next;
    });
  }, []);

  const skipToDone = useCallback(() => {
    setPhase('done');
    setFlippedSet(new Set());
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setMode(null);
    setBoxResult(null);
    setPackResult(null);
    setPackIdx(0);
    setFlippedSet(new Set());
  }, []);

  // Auto-advance only for box-auto mode
  useEffect(() => {
    if (phase !== 'reveal' || mode !== 'box-auto') return;
    const timer = setTimeout(advancePack, AUTO_MS);
    return () => clearTimeout(timer);
  }, [phase, mode, packIdx, advancePack]);

  // Keyboard shortcuts (auto reveal)
  useEffect(() => {
    if (phase !== 'reveal' || mode !== 'box-auto') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        advancePack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, mode, advancePack]);

  // Keyboard shortcuts (manual reveal: space/enter = next card, after all flipped = next pack)
  useEffect(() => {
    if (phase !== 'reveal' || mode !== 'box-manual' || !boxResult) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        const pack = boxResult.packs[packIdx];
        const nextIdx = pack.cards.findIndex((_, i) => !flippedSet.has(i));
        if (nextIdx !== -1) flipCard(nextIdx);
        else advancePack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, mode, boxResult, packIdx, flippedSet, flipCard, advancePack]);

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
        {phase === 'idle' && (
          <IdleScreen meta={setMeta} onStartBox={startBox} onStartPack={startPack} />
        )}

        {phase === 'reveal' && boxResult && mode === 'box-auto' && (
          <AutoBoxReveal
            result={boxResult}
            packIdx={packIdx}
            onAdvance={advancePack}
            onSkip={skipToDone}
          />
        )}

        {phase === 'reveal' && boxResult && mode === 'box-manual' && (
          <ManualBoxReveal
            result={boxResult}
            packIdx={packIdx}
            flippedSet={flippedSet}
            onFlip={flipCard}
            onAdvance={advancePack}
            onSkip={skipToDone}
          />
        )}

        {phase === 'done' && boxResult && mode && mode !== 'pack' && (
          <BoxDoneScreen
            result={boxResult}
            meta={setMeta}
            onRedo={() => startBox(mode)}
            onHome={reset}
          />
        )}

        {phase === 'done' && packResult && mode === 'pack' && (
          <PackDoneScreen
            pack={packResult.pack}
            seed={packResult.seed}
            meta={setMeta}
            onRedo={startPack}
            onHome={reset}
          />
        )}
      </main>
    </div>
  );
}
