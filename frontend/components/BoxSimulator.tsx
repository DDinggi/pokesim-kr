'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { Card, SetMeta, BoxResult, PackResult } from '../lib/types';
import { simulateBox, simulatePack, PROBABILITY_META } from '../lib/simulator';
import { CardModal } from './CardModal';
import { trackSim } from '../lib/statsTracker';

const CDN_BASE = 'https://cards.image.pokemonkorea.co.kr/data/';

const RARITY_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C'];

// 표시용 라벨 — 데이터 태그와 다를 수 있음 (UR ↔ MUR 등)
const RARITY_DISPLAY: Record<string, string> = {
  UR: 'MUR',
};

const RARITY_BADGE: Record<string, string> = {
  C: 'bg-gray-500 text-white',
  U: 'bg-blue-500 text-white',
  R: 'bg-purple-500 text-white',
  RR: 'bg-amber-400 text-gray-900',
  AR: 'bg-cyan-400 text-gray-900',
  SR: 'bg-orange-400 text-gray-900',
  SAR: 'bg-pink-400 text-gray-900',
  MA: 'bg-fuchsia-400 text-gray-900',
  UR: 'bg-yellow-300 text-gray-900',
  BWR: 'bg-gradient-to-r from-gray-100 to-white text-gray-900',
};

const CARD_GLOW: Record<string, string> = {
  RR: 'ring-2 ring-amber-400/60',
  AR: 'ring-2 ring-cyan-400/70',
  SR: 'ring-2 ring-orange-400/80 shadow-md shadow-orange-500/30',
  SAR: 'ring-[3px] ring-pink-400 shadow-lg shadow-pink-500/50',
  MA: 'ring-[3px] ring-fuchsia-400 shadow-lg shadow-fuchsia-500/50',
  UR: 'ring-[3px] ring-yellow-300 shadow-xl shadow-yellow-400/60',
  BWR: 'ring-[3px] ring-white shadow-xl shadow-white/40',
};

// 박스 결과에서 레어로 강조할 등급
const RARE_SET = new Set(['RR', 'AR', 'SR', 'SAR', 'MA', 'UR', 'BWR']);
// 토글 필터 표시 순서 (상위 → 하위)
const FILTER_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR', 'RR'];
const HIT_SET = new Set(['SR', 'SAR', 'MA', 'UR', 'BWR']); // 진짜 hit (SR 이상)

function rarityLabel(r: string): string {
  return RARITY_DISPLAY[r] ?? r;
}

const HIT_RARITY_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR'] as const;
const RARITY_TEXT_COLOR: Record<string, string> = {
  BWR: 'text-slate-100',
  UR: 'text-yellow-300',
  MA: 'text-fuchsia-300',
  SAR: 'text-pink-300',
  SR: 'text-orange-300',
  AR: 'text-cyan-300',
};
function getHitCounts(cards: Card[]): Array<{ rarity: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    if (c.rarity) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
  }
  return HIT_RARITY_ORDER
    .filter((r) => (counts[r] ?? 0) > 0)
    .map((r) => ({ rarity: r, count: counts[r] }));
}

const REVEAL_STAGGER_MS = 140;
const REVEAL_BASE_MS = 600;
const HIT_HOLD_MS = 1200;
const NORMAL_HOLD_MS = 600;
const BETWEEN_MS = 1800;

// 세션 누적 — 세트 변경/새로고침해도 유지 (사용자가 직접 리셋)
const SESSION_STORAGE_KEY = 'pokesim-kr-session-v1';

function loadStoredSession(): Session {
  if (typeof window === 'undefined') return EMPTY_SESSION;
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return EMPTY_SESSION;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cards)) {
      return {
        boxes: Number(parsed.boxes) || 0,
        packs: Number(parsed.packs) || 0,
        cost: Number(parsed.cost) || 0,
        cards: parsed.cards as Card[],
      };
    }
  } catch {
    /* corrupt — fall through */
  }
  return EMPTY_SESSION;
}

function sortByRarity(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity ?? '');
    const bi = RARITY_ORDER.indexOf(b.rarity ?? '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

type Mode = 'box-auto' | 'box-manual' | 'box-instant' | 'pack';
type Phase = 'idle' | 'reveal' | 'done';

interface Session {
  boxes: number;
  packs: number;
  cost: number;
  cards: Card[];
}

const EMPTY_SESSION: Session = { boxes: 0, packs: 0, cost: 0, cards: [] };

function resolveImageUrl(image_url: string): string {
  return /^https?:\/\//.test(image_url) ? image_url : `${CDN_BASE}${image_url}`;
}

// raw CDN URL → /_next/image 최적화 URL로 변환 (브라우저 캐시가 Next.js 렌더 요청과 일치)
function toNextImageUrl(src: string, width = 256, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

function preloadImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  const optimized = urls.map((url) => toNextImageUrl(url));
  let i = 0;
  function next() {
    const chunk = optimized.slice(i, i + 8);
    if (!chunk.length) return;
    chunk.forEach((src) => { (new window.Image()).src = src; });
    i += 8;
    if (i < optimized.length) setTimeout(next, 80);
  }
  next();
}

function CardTile({
  card,
  size = 'md',
  onClick,
  priority = false,
}: {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  priority?: boolean;
}) {
  const glow = card.rarity ? (CARD_GLOW[card.rarity] ?? '') : '';
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const Wrapper = onClick ? 'button' : 'div';
  const sizesAttr =
    size === 'sm'
      ? '(max-width: 640px) 12vw, (max-width: 1024px) 8vw, 100px'
      : '(max-width: 640px) 20vw, (max-width: 1024px) 15vw, 200px';
  return (
    <Wrapper
      onClick={onClick}
      className={`relative aspect-[5/7] rounded-lg overflow-hidden block w-full bg-gray-800 ${glow} ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''}`}
    >
      {errored || !card.image_url ? (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-2 text-center">
          <span className="text-[10px] text-gray-400 leading-tight">
            {card.name_ko ?? card.card_num}
          </span>
          {card.rarity && <span className="text-[9px] text-gray-500 mt-1">{card.rarity}</span>}
        </div>
      ) : (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
          )}
          <Image
            src={resolveImageUrl(card.image_url)}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes={sizesAttr}
            className="object-cover"
            priority={priority}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </>
      )}
      {size !== 'sm' && card.rarity && (
        <span
          className={`absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'} z-10`}
        >
          {rarityLabel(card.rarity)}
        </span>
      )}
    </Wrapper>
  );
}

function CardBack() {
  return (
    <div className="aspect-[5/7] rounded-lg bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 flex items-center justify-center shadow-md ring-1 ring-white/10">
      <span className="text-white/30 text-4xl font-black select-none">?</span>
    </div>
  );
}

function RareHistory({
  result,
  upToPackIdx,
  onCardClick,
}: {
  result: BoxResult;
  upToPackIdx: number;
  onCardClick: (c: Card) => void;
}) {
  const seen = result.packs.slice(0, upToPackIdx).flatMap((p) => p.cards);
  const rares = seen.filter((c) => c.rarity && RARE_SET.has(c.rarity));
  if (rares.length === 0 && upToPackIdx === 0) return null;
  return (
    <div className="w-full max-w-4xl mx-auto px-2 mt-4">
      <p className="text-xs text-gray-500 mb-2 tracking-wide">
        지금까지 {upToPackIdx}팩 깠음 · 레어 {rares.length}장
      </p>
      {rares.length > 0 ? (
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
          {rares.map((c, i) => (
            <CardTile key={i} card={c} size="sm" onClick={() => onCardClick(c)} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-700">아직 RR 이상 카드 없음</p>
      )}
    </div>
  );
}

function SessionBar({ session, onReset }: { session: Session; onReset: () => void }) {
  const total = session.boxes + session.packs;
  if (total === 0) return null;
  const hits = getHitCounts(session.cards);
  const handleReset = () => {
    if (window.confirm('지금까지 깐 카드 기록을 모두 초기화할까요?')) onReset();
  };
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2.5 flex items-start justify-between gap-3 text-[11px] text-gray-400 bg-gray-900/50 rounded-lg ring-1 ring-white/5">
      <span className="min-w-0">
        지금까지 깐 카드: 박스 <span className="text-white font-bold">{session.boxes}</span>
        {' · '}팩 <span className="text-white font-bold">{session.packs}</span>
        {' · '}<span className="text-white font-bold tabular-nums">{session.cost.toLocaleString()}원</span>
        {hits.map(({ rarity, count }) => (
          <span key={rarity} className={RARITY_TEXT_COLOR[rarity]}>
            {' · '}{rarityLabel(rarity)} <span className="font-bold">{count}</span>장
          </span>
        ))}
      </span>
      <button
        onClick={handleReset}
        className="text-gray-500 hover:text-red-400 transition-colors text-[10px] underline-offset-2 hover:underline shrink-0"
      >
        리셋
      </button>
    </div>
  );
}

function PokeballSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`pokeball-spin ${className}`}>
      <div className="relative w-full h-full rounded-full ring-4 ring-gray-900 overflow-hidden bg-white shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-red-500" />
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-gray-900" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-gray-900 z-10" />
      </div>
    </div>
  );
}

function TransitionScreen({
  label,
  sublabel,
  gifIndex,
  onSkip,
  skipLabel,
}: {
  label: string;
  sublabel?: string;
  gifIndex: number;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const gifSrc = gifIndex % 2 === 0 ? '/loading.gif' : '/loading2.gif';
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => {
    setImgErr(false);
  }, [gifSrc]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] gap-6 select-none px-4">
      <div className="relative w-32 h-32 sm:w-40 sm:h-40">
        {!imgErr ? (
          <Image
            key={gifSrc}
            src={gifSrc}
            alt=""
            fill
            sizes="160px"
            className="object-contain"
            onError={() => setImgErr(true)}
            unoptimized
          />
        ) : (
          <PokeballSpinner className="w-full h-full" />
        )}
      </div>
      <p className="text-base font-bold text-gray-300 animate-pulse">{label}</p>
      {sublabel && <p className="text-xs text-gray-500 tabular-nums">{sublabel}</p>}
      {onSkip && (
        <button
          onClick={onSkip}
          className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors underline-offset-2 hover:underline"
        >
          {skipLabel ?? '바로 →'}
        </button>
      )}
    </div>
  );
}

function IdleScreen({
  meta,
  session,
  onStartBox,
  onResetSession,
}: {
  meta: SetMeta;
  session: Session;
  onStartBox: (mode: 'box-auto' | 'box-manual' | 'box-instant') => void;
  onResetSession: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-72px)] px-4 py-8 gap-6">
      <div className="text-center max-w-xl flex flex-col items-center">
        {!imgErr && (
          <div className="relative w-52 h-64 sm:w-64 sm:h-80 mb-4">
            <Image
              src={`/boxes/${meta.code}.png`}
              alt={meta.name_ko}
              fill
              sizes="280px"
              className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
              onError={() => setImgErr(true)}
              priority
            />
          </div>
        )}
        <p className="text-2xl sm:text-3xl font-black mb-1 tracking-tight">{meta.name_ko}</p>
        <p className="text-gray-500 text-xs">
          {meta.cards.length}종 · {meta.box_size}팩 · {meta.pack_size}장/팩 ·{' '}
          {meta.type === 'hi-class' ? '하이클래스' : '확장팩'}
        </p>
      </div>

      <SessionBar session={session} onReset={onResetSession} />

      <section className="w-full max-w-2xl">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
          박스깡 · ₩{meta.box_price_krw.toLocaleString()}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onStartBox('box-auto')}
            className="py-8 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 transition font-bold text-lg shadow-xl shadow-red-900/40 flex flex-col gap-1"
          >
            자동
            <span className="text-[11px] font-normal text-red-100/90">한 팩씩 자동 개봉</span>
          </button>
          <button
            onClick={() => onStartBox('box-instant')}
            className="py-8 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-600 active:scale-95 transition font-bold text-lg shadow-xl shadow-orange-900/40 flex flex-col gap-1"
          >
            즉시
            <span className="text-[11px] font-normal text-orange-100/90">결과 바로 보기</span>
          </button>
        </div>
      </section>

      <p className="text-[11px] text-gray-600 text-center max-w-md leading-relaxed mt-2">
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
  onCardClick,
}: {
  result: BoxResult;
  packIdx: number;
  onAdvance: () => void;
  onSkip: () => void;
  onCardClick: (c: Card) => void;
}) {
  const pack = result.packs[packIdx];
  const total = result.packs.length;
  const progress = ((packIdx + 1) / total) * 100;
  const isLast = packIdx + 1 >= total;
  const hitIdx = pack.cards.length - 1;
  const hitCard = pack.cards[hitIdx];
  const isRareHit = hitCard?.rarity ? HIT_SET.has(hitCard.rarity) : false;

  return (
      <div className="flex flex-col items-center gap-5 px-4 py-6 min-h-[calc(100vh-72px)] select-none">
        <div className="text-center" onClick={onAdvance}>
          <p className="text-2xl font-bold tabular-nums">
            {packIdx + 1} / {total} 팩
          </p>
          <div className="mt-2 w-64 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {isRareHit ? (
          <p
            key={`hit-${packIdx}`}
            className="text-base font-bold text-amber-300 animate-pulse h-6"
          >
            ✨ {rarityLabel(hitCard.rarity!)} 당첨!
          </p>
        ) : (
          <p className="h-6" />
        )}

        <div
          key={`pack-${packIdx}`}
          className="relative grid grid-cols-5 gap-3 sm:gap-4 w-full max-w-4xl mx-auto cursor-pointer"
          onClick={onAdvance}
        >
          {pack.cards.map((card, i) => {
            const isHit = i === hitIdx && isRareHit;
            const delay = i * REVEAL_STAGGER_MS + (i === hitIdx ? 200 : 0);
            return (
              <div key={i} onClick={(e) => e.stopPropagation()} className="relative">
                {isHit && (
                  <div
                    className="absolute inset-0 burst-rays rounded-lg pointer-events-none z-0"
                    style={{ animationDelay: `${delay + 400}ms` }}
                  />
                )}
                <div
                  className={`relative z-10 rounded-lg ${isHit ? 'card-reveal-hit' : 'card-reveal'}`}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <CardTile card={card} size="lg" onClick={() => onCardClick(card)} priority />
                </div>
              </div>
            );
          })}
        </div>

        <RareHistory result={result} upToPackIdx={packIdx} onCardClick={onCardClick} />

        <div className="flex flex-col items-center gap-2 mt-auto pt-2">
          <p className="text-xs text-gray-500">화면 클릭 · 스페이스바로 다음 팩</p>
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              전체 결과 바로 보기 →
            </button>
          </div>
          {isLast && (
            <button
              onClick={onAdvance}
              className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold"
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
  onCardClick,
}: {
  result: BoxResult;
  packIdx: number;
  flippedSet: Set<number>;
  onFlip: (i: number) => void;
  onAdvance: () => void;
  onSkip: () => void;
  onCardClick: (c: Card) => void;
}) {
  const pack = result.packs[packIdx];
  const total = result.packs.length;
  const progress = ((packIdx + 1) / total) * 100;
  const isLast = packIdx + 1 >= total;
  const allFlipped = flippedSet.size === pack.cards.length;
  const remaining = pack.cards.length - flippedSet.size;
  const nextIdx = allFlipped ? -1 : pack.cards.findIndex((_, i) => !flippedSet.has(i));

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6 min-h-[calc(100vh-72px)] select-none">
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums">
          {packIdx + 1} / {total} 팩
        </p>
        <div className="mt-2 w-64 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 sm:gap-4 w-full max-w-4xl mx-auto">
        {pack.cards.map((card, i) =>
          flippedSet.has(i) ? (
            <CardTile key={i} card={card} size="lg" onClick={() => onCardClick(card)} priority />
          ) : (
            <div
              key={i}
              className="aspect-[5/7] rounded-lg border-2 border-dashed border-gray-800/70 bg-gray-900/30"
            />
          ),
        )}
      </div>

      {!allFlipped && nextIdx !== -1 && (
        <button
          onClick={() => onFlip(nextIdx)}
          className="w-44 sm:w-52 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        >
          <CardBack />
          <p className="text-xs text-gray-400 mt-2 text-center">
            남은 {remaining}장 · 클릭해서 까기
          </p>
        </button>
      )}
      {allFlipped && (
        <button
          onClick={onAdvance}
          className="w-44 sm:w-52 px-6 py-5 rounded-xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 transition font-bold text-base shadow-xl shadow-red-900/40 animate-pulse"
        >
          {isLast ? '결과 보기 →' : '다음 팩 →'}
        </button>
      )}

      <RareHistory result={result} upToPackIdx={packIdx} onCardClick={onCardClick} />

      <div className="flex flex-col items-center gap-2 mt-auto pt-2">
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

function SummaryGrid({ summary }: { summary: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RARITY_ORDER.map((r) => {
        const count = summary[r];
        if (!count) return null;
        return (
          <div
            key={r}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${RARITY_BADGE[r] ?? 'bg-gray-600 text-white'}`}
          >
            {rarityLabel(r)} ×{count}
          </div>
        );
      })}
    </div>
  );
}

function CollectionGrid({
  cards,
  onCardClick,
}: {
  cards: Card[];
  onCardClick: (c: Card) => void;
}) {
  const sorted = sortByRarity(cards);
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-1.5">
      {sorted.map((card, i) => (
        <CardTile key={i} card={card} size="sm" onClick={() => onCardClick(card)} />
      ))}
    </div>
  );
}

function RarityFilteredGrid({
  cards,
  onCardClick,
}: {
  cards: Card[];
  onCardClick: (c: Card) => void;
}) {
  const counts = cards.reduce<Record<string, number>>((acc, c) => {
    if (c.rarity) acc[c.rarity] = (acc[c.rarity] ?? 0) + 1;
    return acc;
  }, {});
  const available = FILTER_ORDER.filter((r) => (counts[r] ?? 0) > 0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(available));

  const toggle = (r: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const filtered = cards.filter((c) => c.rarity && selected.has(c.rarity));
  const sorted = sortByRarity(filtered);

  if (available.length === 0) {
    return <p className="text-xs text-gray-600">레어 카드 없음</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {available.map((r) => {
          const isOn = selected.has(r);
          return (
            <button
              key={r}
              onClick={() => toggle(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition active:scale-95 ${
                isOn
                  ? (RARITY_BADGE[r] ?? 'bg-gray-600 text-white')
                  : 'bg-gray-800 text-gray-500 ring-1 ring-gray-700'
              }`}
            >
              {rarityLabel(r)} ×{counts[r]}
            </button>
          );
        })}
      </div>
      {sorted.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {sorted.map((card, i) => (
            <CardTile key={i} card={card} size="lg" onClick={() => onCardClick(card)} priority />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600 py-6 text-center">선택된 등급 없음 — 위 토글을 눌러보세요</p>
      )}
    </div>
  );
}

function BoxDoneScreen({
  result,
  meta,
  session,
  onRedo,
  onChangeMode,
  onChangeSet,
  onCardClick,
  onResetSession,
}: {
  result: BoxResult;
  meta: SetMeta;
  session: Session;
  onRedo: () => void;
  onChangeMode: () => void;
  onChangeSet: () => void;
  onCardClick: (c: Card) => void;
  onResetSession: () => void;
}) {
  const allCards = result.packs.flatMap((p) => p.cards);
  const rares = allCards.filter((c) => c.rarity && RARE_SET.has(c.rarity));
  const sessionRares = sortByRarity(session.cards.filter((c) => c.rarity && RARE_SET.has(c.rarity)));


  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">박스깡 결과</h2>
        <p className="text-gray-400 text-sm mt-1">
          {meta.name_ko} · ₩{meta.box_price_krw.toLocaleString()} · {allCards.length}장
        </p>
      </div>

      <div className="mb-6">
        <SummaryGrid summary={result.summary} />
      </div>

      <section className="mb-8">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          ✨ 이번 박스 레어 ({rares.length}장) — 등급 토글로 필터
        </h3>
        <RarityFilteredGrid cards={allCards} onCardClick={onCardClick} />
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] text-gray-700 hover:text-gray-500 select-none w-fit">
            전체 {allCards.length}장 보기 (커먼/언커먼 포함)
          </summary>
          <div className="mt-3">
            <CollectionGrid cards={allCards} onCardClick={onCardClick} />
          </div>
        </details>
      </section>

      {/* 액션 버튼 */}
      <div className="mb-5 flex flex-wrap justify-center gap-3">
        <button
          onClick={onRedo}
          className="px-10 py-3 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 rounded-xl font-bold transition shadow-lg shadow-red-900/40"
        >
          한 박스 더 깡!
        </button>
        <button
          onClick={onChangeMode}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 rounded-xl font-bold transition"
        >
          모드 변경
        </button>
        <button
          onClick={onChangeSet}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl font-bold transition"
        >
          ← 다른 박스 선택
        </button>
      </div>

      {(session.boxes > 0 || session.packs > 0) && (
        <details className="mb-8 pt-6 border-t border-white/5" open={session.boxes <= 1}>
          <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-xs font-bold text-gray-400 tracking-wider hover:text-gray-200">
            <span>
              🗂 지금까지 깐 카드 — 박스 {session.boxes} · 팩 {session.packs} ·{' '}
              {session.cost.toLocaleString()}원
              {getHitCounts(session.cards).map(({ rarity, count }) => (
                <span key={rarity} className={RARITY_TEXT_COLOR[rarity]}>
                  {' · '}{rarityLabel(rarity)} {count}장
                </span>
              ))}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('지금까지 깐 카드 기록을 모두 초기화할까요?')) onResetSession();
              }}
              className="ml-4 shrink-0 normal-case font-normal text-gray-500 hover:text-red-400 transition-colors underline-offset-2 hover:underline tracking-normal"
            >
              초기화
            </button>
          </summary>
          <div className="mt-3">
            {sessionRares.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-4">
                {sessionRares.map((c, i) => (
                  <CardTile key={i} card={c} size="lg" onClick={() => onCardClick(c)} priority />
                ))}
              </div>
            )}
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-300">
                누적 전체 {session.cards.length}장 보기
              </summary>
              <div className="mt-3">
                <CollectionGrid cards={session.cards} onCardClick={onCardClick} />
              </div>
            </details>
          </div>
        </details>
      )}

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
  session,
  onRedo,
  onChangeMode,
  onChangeSet,
  onCardClick,
}: {
  pack: PackResult;
  seed: string;
  meta: SetMeta;
  session: Session;
  onRedo: () => void;
  onChangeMode: () => void;
  onChangeSet: () => void;
  onCardClick: (c: Card) => void;
}) {
  const hitCard = pack.cards[pack.cards.length - 1];
  const isRareHit = hitCard?.rarity ? HIT_SET.has(hitCard.rarity) : false;
  const sessionRares = sortByRarity(session.cards.filter((c) => c.rarity && RARE_SET.has(c.rarity)));

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-3xl font-black tracking-tight">자판기 1팩</h2>
        <p className="text-gray-400 text-sm mt-1">
          {meta.name_ko} · ₩{meta.pack_price_krw.toLocaleString()} · {pack.cards.length}장
        </p>
      </div>

      {isRareHit && (
        <p className="text-base font-bold text-amber-300 animate-pulse">
          ✨ {rarityLabel(hitCard.rarity!)} 당첨!
        </p>
      )}

      <div className="grid grid-cols-5 gap-3 sm:gap-4 w-full">
        {pack.cards.map((card, i) => (
          <CardTile key={i} card={card} size="lg" onClick={() => onCardClick(card)} />
        ))}
      </div>

      {(session.boxes > 0 || session.packs > 0) && (
        <section className="w-full pt-4 border-t border-white/5">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-3">
            🗂 지금까지 깐 카드 — 박스 {session.boxes} · 팩 {session.packs} ·{' '}
            {session.cost.toLocaleString()}원
            {getHitCounts(session.cards).map(({ rarity, count }) => (
              <span key={rarity} className={RARITY_TEXT_COLOR[rarity]}>
                {' · '}{rarityLabel(rarity)} {count}장
              </span>
            ))}
          </h3>
          {sessionRares.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {sessionRares.map((c, i) => (
                <CardTile key={i} card={c} size="lg" onClick={() => onCardClick(c)} priority />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-3 mt-4">
        <button
          onClick={onRedo}
          className="px-10 py-3 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-95 rounded-xl font-bold transition shadow-lg shadow-blue-900/40"
        >
          1팩 더!
        </button>
        <button
          onClick={onChangeMode}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 rounded-xl font-bold transition"
        >
          모드 변경
        </button>
        <button
          onClick={onChangeSet}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl font-bold transition"
        >
          ← 다른 박스 선택
        </button>
      </div>

      <p className="text-[11px] text-gray-600 text-center">
        ⓘ 자판기 모드는 박스 보장룰이 없습니다
      </p>
      <p className="text-[10px] text-gray-700 text-center font-mono break-all">seed: {seed}</p>
    </div>
  );
}

export function BoxSimulator({
  setMeta,
  onChangeSet,
}: {
  setMeta: SetMeta;
  onChangeSet: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode | null>(null);
  const [boxResult, setBoxResult] = useState<BoxResult | null>(null);
  const [packResult, setPackResult] = useState<{ pack: PackResult; seed: string } | null>(null);
  const [packIdx, setPackIdx] = useState(0);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [modalCard, setModalCard] = useState<Card | null>(null);
  // "한 박스 더 깡!" 클릭 시 트랜지션 — 그 외엔 null
  const [pendingBoxRedo, setPendingBoxRedo] = useState<'box-auto' | 'box-manual' | 'box-instant' | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const manualPacksRecorded = useRef<Set<number>>(new Set());

  // 마운트 1회 — 세션을 localStorage에서 복구
  useEffect(() => {
    setSession(loadStoredSession());
    setHydrated(true);
  }, []);

  // 세션 변경 → localStorage 저장 (hydrate 끝나기 전엔 덮어쓰지 않음)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* quota / 비공개 모드 — 무시 */
    }
  }, [session, hydrated]);

  // 세트 변경 시 시뮬 상태만 리셋 (세션은 유지 — 사용자가 직접 리셋)
  useEffect(() => {
    setPhase('idle');
    setMode(null);
    setBoxResult(null);
    setPackResult(null);
    setPackIdx(0);
    setFlippedSet(new Set());
    setPendingBoxRedo(null);
  }, [setMeta.code]);

  const resetSession = useCallback(() => {
    setSession(EMPTY_SESSION);
  }, []);

  const startBox = useCallback(
    (m: 'box-auto' | 'box-manual' | 'box-instant') => {
      manualPacksRecorded.current = new Set();
      const result = simulateBox(setMeta.cards, setMeta.box_size, setMeta.type, setMeta.pack_size, undefined, setMeta.code);
      setBoxResult(result);
      setMode(m);
      setPackIdx(0);
      setFlippedSet(new Set());
      setPendingBoxRedo(null);
      setPhase(m === 'box-instant' ? 'done' : 'reveal');
      // 박스 전체 카드 이미지 미리 로딩 — 팩 펼칠 때 이미 캐시됨
      const urls = result.packs
        .flatMap((p) => p.cards)
        .filter((c) => c.image_url)
        .map((c) => resolveImageUrl(c.image_url!));
      preloadImages(urls);
    },
    [setMeta],
  );

  // "한 박스 더 깡!" — 트랜지션 띄우고 BETWEEN_MS 후 새 박스 시작
  const triggerBoxRedo = useCallback((m: 'box-auto' | 'box-manual' | 'box-instant') => {
    setPendingBoxRedo(m);
  }, []);

  useEffect(() => {
    if (!pendingBoxRedo) return;
    const target = pendingBoxRedo;
    const t = setTimeout(() => {
      startBox(target);
    }, BETWEEN_MS);
    return () => clearTimeout(t);
  }, [pendingBoxRedo, startBox]);

  const startPack = useCallback(() => {
    const result = simulatePack(setMeta.cards, setMeta.type, setMeta.pack_size);
    setPackResult(result);
    setMode('pack');
    setPhase('done');
  }, [setMeta]);

  // phase 가 done 으로 진입할 때 1회 세션 누적 + Supabase 트래킹
  useEffect(() => {
    if (phase !== 'done') return;
    if (mode === 'pack' && packResult) {
      setSession((s) => ({
        ...s,
        packs: s.packs + 1,
        cost: s.cost + setMeta.pack_price_krw,
        cards: [...s.cards, ...packResult.pack.cards],
      }));
      trackSim({ setCode: setMeta.code, mode: 'pack', boxCount: 0, packCount: 1, krw: setMeta.pack_price_krw });
    } else if (mode === 'box-manual' && boxResult) {
      // 카드는 advancePack에서 팩별로 이미 누적됨; skip(전체결과 바로보기) 시 미기록 팩 보완
      const skipped = boxResult.packs.flatMap((p, i) =>
        manualPacksRecorded.current.has(i) ? [] : p.cards,
      );
      boxResult.packs.forEach((_, i) => manualPacksRecorded.current.add(i));
      setSession((s) => ({
        ...s,
        boxes: s.boxes + 1,
        cost: s.cost + setMeta.box_price_krw,
        ...(skipped.length > 0 && { cards: [...s.cards, ...skipped] }),
      }));
      trackSim({ setCode: setMeta.code, mode: 'box', boxCount: 1, packCount: setMeta.box_size, krw: setMeta.box_price_krw });
    } else if (mode && mode !== 'pack' && boxResult) {
      const all = boxResult.packs.flatMap((p) => p.cards);
      setSession((s) => ({
        ...s,
        boxes: s.boxes + 1,
        cost: s.cost + setMeta.box_price_krw,
        cards: [...s.cards, ...all],
      }));
      trackSim({ setCode: setMeta.code, mode: 'box', boxCount: 1, packCount: setMeta.box_size, krw: setMeta.box_price_krw });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, boxResult?.seed, packResult?.seed]);

  // 다음 팩으로 즉시 이동. 마지막 팩이면 결과 화면으로.
  // 수동 모드: 팩 완료 시마다 즉시 카드 세션 누적
  const advancePack = useCallback(() => {
    if (!boxResult) return;
    if (mode === 'box-manual' && !manualPacksRecorded.current.has(packIdx)) {
      manualPacksRecorded.current.add(packIdx);
      const packCards = boxResult.packs[packIdx].cards;
      setSession((s) => ({ ...s, cards: [...s.cards, ...packCards] }));
    }
    if (packIdx + 1 >= boxResult.packs.length) {
      setPhase('done');
    } else {
      setPackIdx(packIdx + 1);
      setFlippedSet(new Set());
    }
  }, [boxResult, packIdx, mode]);

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

  const goToIdle = useCallback(() => {
    // reveal 도중 이탈 시 — 이미 시뮬레이션된 결과를 세션에 커밋
    if (phase === 'reveal') {
      if (mode === 'pack' && packResult) {
        setSession((s) => ({
          ...s,
          packs: s.packs + 1,
          cost: s.cost + setMeta.pack_price_krw,
          cards: [...s.cards, ...packResult.pack.cards],
        }));
        trackSim({ setCode: setMeta.code, mode: 'pack', boxCount: 0, packCount: 1, krw: setMeta.pack_price_krw });
      } else if (boxResult) {
        const all = boxResult.packs.flatMap((p) => p.cards);
        // box-manual은 advancePack에서 팩별로 일부 이미 누적됐을 수 있으므로 미기록분만 추가
        const unrecorded = mode === 'box-manual'
          ? boxResult.packs.flatMap((p, i) => manualPacksRecorded.current.has(i) ? [] : p.cards)
          : all;
        setSession((s) => ({
          ...s,
          boxes: s.boxes + 1,
          cost: s.cost + setMeta.box_price_krw,
          cards: [...s.cards, ...unrecorded],
        }));
        trackSim({ setCode: setMeta.code, mode: 'box', boxCount: 1, packCount: setMeta.box_size, krw: setMeta.box_price_krw });
      }
    }
    setPhase('idle');
    setMode(null);
    setBoxResult(null);
    setPackResult(null);
    setPackIdx(0);
    setFlippedSet(new Set());
    setPendingBoxRedo(null);
  }, [phase, mode, packResult, boxResult, setMeta]);

  // 자동 모드 — stagger reveal 끝난 뒤 hold 후 다음 팩(또는 결과)
  useEffect(() => {
    if (phase !== 'reveal' || mode !== 'box-auto' || !boxResult) return;
    const total = boxResult.packs.length;
    const pack = boxResult.packs[packIdx];
    if (!pack) return;
    const hitIdx = pack.cards.length - 1;
    const hitCard = pack.cards[hitIdx];
    const isRareHit = hitCard?.rarity ? HIT_SET.has(hitCard.rarity) : false;
    const revealEnd = hitIdx * REVEAL_STAGGER_MS + (isRareHit ? 200 : 0) + REVEAL_BASE_MS;
    const hold = isRareHit ? HIT_HOLD_MS : NORMAL_HOLD_MS;
    const t = setTimeout(() => {
      if (packIdx + 1 >= total) {
        setPhase('done');
      } else {
        setPackIdx(packIdx + 1);
        setFlippedSet(new Set());
      }
    }, revealEnd + hold);
    return () => clearTimeout(t);
  }, [phase, mode, packIdx, boxResult]);

  // 키보드 — 박스 모드 (자동/수동 공통)
  useEffect(() => {
    if (phase !== 'reveal' || (mode !== 'box-auto' && mode !== 'box-manual') || !boxResult) return;
    const h = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowRight' && e.code !== 'Enter') return;
      e.preventDefault();
      if (mode === 'box-manual') {
        const pack = boxResult.packs[packIdx];
        const ni = pack.cards.findIndex((_, i) => !flippedSet.has(i));
        if (ni !== -1) {
          flipCard(ni);
          return;
        }
      }
      advancePack();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, mode, boxResult, packIdx, flippedSet, flipCard, advancePack]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80 flex items-center justify-between shrink-0">
        <div>
          <button
            onClick={onChangeSet}
            className="text-2xl font-bold tracking-tight hover:text-gray-300 transition-colors"
          >
            PokéSim KR
          </button>
          <p className="text-xs text-gray-400 mt-1">{setMeta.name_ko}</p>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={goToIdle}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            처음으로
          </button>
        )}
      </header>

      <main className="flex-1">
        {/* 박스 재시작 트랜지션 — 다른 화면 모두 덮음 */}
        {pendingBoxRedo ? (
          <TransitionScreen
            label="새 박스 까는 중..."
            sublabel={`박스 #${session.boxes + 1} 준비 중`}
            gifIndex={session.boxes}
          />
        ) : (
          <>
            {phase === 'idle' && (
              <IdleScreen
                meta={setMeta}
                session={session}
                onStartBox={startBox}
                onResetSession={resetSession}
              />
            )}

            {phase === 'reveal' && boxResult && mode === 'box-auto' && (
              <AutoBoxReveal
                result={boxResult}
                packIdx={packIdx}
                onAdvance={advancePack}
                onSkip={skipToDone}
                onCardClick={setModalCard}
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
                onCardClick={setModalCard}
              />
            )}

            {phase === 'done' && boxResult && mode && mode !== 'pack' && (
              <BoxDoneScreen
                result={boxResult}
                meta={setMeta}
                session={session}
                onRedo={() => triggerBoxRedo(mode)}
                onChangeMode={goToIdle}
                onChangeSet={onChangeSet}
                onCardClick={setModalCard}
                onResetSession={resetSession}
              />
            )}

            {phase === 'done' && packResult && mode === 'pack' && (
              <PackDoneScreen
                pack={packResult.pack}
                seed={packResult.seed}
                meta={setMeta}
                session={session}
                onRedo={startPack}
                onChangeMode={goToIdle}
                onChangeSet={onChangeSet}
                onCardClick={setModalCard}
              />
            )}
          </>
        )}
      </main>

      {modalCard && <CardModal card={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );
}
