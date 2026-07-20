'use client';

import { useState, useMemo, type ReactNode } from 'react';
import Image from 'next/image';
import type { Card, SetMeta, PackResult } from '../lib/types';
import { simulatePack } from '../lib/simulator';
import { simulateStartDeck } from '../lib/simulation/starter';
import { getBoxThumbnailImageSrc } from '../lib/boxImages';
import {
  createLuckOpening,
  summarizeLuckEvent,
} from '../lib/luck';
import { NEW_SIM_SET_NAMES, isNewSimSet } from '../lib/newSets';
import { trackSim, trackUserEvent } from '../lib/statsTracker';
import { CardModal } from './CardModal';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import {
  CARD_GLOW,
  RARITY_BADGE,
  RARITY_TEXT_COLOR,
  getHitCounts,
  isPremiumSparkleRarity,
  premiumSparkleVariant,
  rarityLabel,
  sortByRarity,
} from '../lib/rarity';
import {
  createOpeningEvent,
  loadOpeningSession,
  saveOpeningSession,
  type OpeningEvent,
  type OpeningSession,
} from '../lib/openingHistory';
import { addCardsToHitDex } from '../lib/hitDex';
import {
  getAvailableSetSeries,
  getSetSeriesKey,
  type SetSeriesKey,
} from '../lib/setSeries';
import { SetSeriesTabs } from './SetSeriesTabs';

const MAX_PER_SET = 10;

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

function loadSession(): OpeningSession {
  return loadOpeningSession();
}

function saveSession(s: OpeningSession) {
  saveOpeningSession(s);
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

type Phase = 'browse' | 'reveal' | 'done';

interface PurchasedPack {
  setCode: string;
  setMeta: SetMeta;
  pack: PackResult;
  seed: string;
}

export function VendingMachine({
  sets,
  onBackToMain,
  onOpenLuck,
  onOpenHitDex,
  accountBar,
}: {
  sets: SetMeta[];
  onBackToMain: () => void;
  onOpenLuck: (setCode?: string) => void;
  onOpenHitDex: () => void;
  accountBar?: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>('browse');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [modalSet, setModalSet] = useState<SetMeta | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [purchased, setPurchased] = useState<PurchasedPack[]>([]);
  const [packIdx, setPackIdx] = useState(0);
  const [openedCard, setOpenedCard] = useState<Card | null>(null);
  const [query, setQuery] = useState('');
  const [activeSeries, setActiveSeries] = useState<SetSeriesKey>(
    () => getAvailableSetSeries(sets)[0]?.key ?? 'mega',
  );
  const displaySets = sets;
  const availableSeries = useMemo(() => getAvailableSetSeries(displaySets), [displaySets]);
  const selectedSeries = availableSeries.some((series) => series.key === activeSeries)
    ? activeSeries
    : (availableSeries[0]?.key ?? 'mega');
  const seriesSets = useMemo(
    () => displaySets.filter((set) => getSetSeriesKey(set) === selectedSeries),
    [displaySets, selectedSeries],
  );
  const isSearching = query.trim().length > 0;
  const visibleSets = useMemo(
    () => (isSearching ? displaySets : seriesSets).filter((set) => matchSet(set, query)),
    [displaySets, isSearching, query, seriesSets],
  );

  const totalPacks = useMemo(
    () => Object.values(cart).reduce((s, n) => s + n, 0),
    [cart],
  );
  const totalCost = useMemo(
    () =>
      Object.entries(cart).reduce((s, [code, n]) => {
        const set = displaySets.find((x) => x.code === code);
        return s + (set?.pack_price_krw ?? 0) * n;
      }, 0),
    [cart, displaySets],
  );

  function openModal(set: SetMeta) {
    trackUserEvent({ eventName: 'select_set', setCode: set.code, mode: 'vending' });
    setModalSet(set);
    // 기본 수량: 이미 담긴 게 있으면 그 값, 없으면 1
    setModalQty(cart[set.code] ?? 1);
  }
  function closeModal() {
    setModalSet(null);
  }
  function modalIncrement() {
    setModalQty((q) => Math.min(q + 1, MAX_PER_SET));
  }
  function modalDecrement() {
    setModalQty((q) => Math.max(0, q - 1));
  }
  function handleAddToCart() {
    if (!modalSet) return;
    setCart((c) => {
      const next = { ...c };
      if (modalQty <= 0) delete next[modalSet.code];
      else next[modalSet.code] = modalQty;
      return next;
    });
    closeModal();
  }
  function handleBuyNow() {
    if (!modalSet || modalQty <= 0) return;
    const newCart = { ...cart, [modalSet.code]: modalQty };
    setModalSet(null);
    runCheckout(newCart);
  }
  function handleRemoveFromCart(code: string) {
    setCart((c) => {
      const next = { ...c };
      delete next[code];
      return next;
    });
  }
  function handleCheckout() {
    if (totalPacks === 0) return;
    runCheckout(cart);
  }
  function runCheckout(cartToBuy: Record<string, number>) {
    const packs: PurchasedPack[] = [];
    const openingEvents: OpeningEvent[] = [];
    for (const [code, n] of Object.entries(cartToBuy)) {
      const set = displaySets.find((x) => x.code === code);
      if (!set || n <= 0) continue;
      const setCards: Card[] = [];
      for (let i = 0; i < n; i++) {
        const { pack, seed } = set.type === 'starter' && set.start_deck
          ? (() => {
            const drawn = simulateStartDeck(set.cards, set.start_deck);
            return { pack: { cards: drawn.cards }, seed: drawn.seed };
          })()
          : simulatePack(set.cards, set.type, set.pack_size, undefined, set.code);
        setCards.push(...pack.cards);
        packs.push({ setCode: code, setMeta: set, pack, seed });
      }
      const opening = createLuckOpening(set, { packs: n });
      trackSim({
        setCode: code,
        mode: 'pack',
        boxCount: 0,
        packCount: n,
        krw: (set.pack_price_krw ?? 0) * n,
        luck: summarizeLuckEvent(setCards, opening, set),
      });
      openingEvents.push(createOpeningEvent({
        setMeta: set,
        unit: 'pack',
        source: 'vending-machine',
        cards: setCards,
        boxCount: 0,
        packCount: n,
        krw: (set.pack_price_krw ?? 0) * n,
      }));
      addCardsToHitDex(setCards, set);
    }
    if (packs.length === 0) return;

    const allCards = packs.flatMap((p) => p.pack.cards);
    const checkoutCost = Object.entries(cartToBuy).reduce((s, [code, n]) => {
      const set = displaySets.find((x) => x.code === code);
      return s + (set?.pack_price_krw ?? 0) * n;
    }, 0);

    const cur = loadSession();

    saveSession({
      boxes: cur.boxes,
      packs: cur.packs + packs.length,
      cost: cur.cost + checkoutCost,
      cards: [...cur.cards, ...allCards],
      openingEvents: [...cur.openingEvents, ...openingEvents],
    });

    setPurchased(packs);
    setPackIdx(0);
    setPhase('reveal');
  }
  function handleNextPack() {
    if (packIdx >= purchased.length - 1) {
      setPhase('done');
    } else {
      setPackIdx((i) => i + 1);
    }
  }
  function handleRestart() {
    const setCodes = Array.from(new Set(purchased.map((p) => p.setCode)));
    trackUserEvent({
      eventName: 'open_again',
      setCode: setCodes.length === 1 ? setCodes[0] : undefined,
      mode: 'vending',
      metadata: {
        pack_count: purchased.length,
        set_count: setCodes.length,
      },
    });
    setCart({});
    setPurchased([]);
    setPackIdx(0);
    setPhase('browse');
  }
  function openCard(card: Card, setCode?: string) {
    trackUserEvent({
      eventName: 'open_card_modal',
      setCode,
      mode: 'vending',
      rarity: card.rarity ?? null,
    });
    setOpenedCard(card);
  }

  // ─────────────────────────── REVEAL ───────────────────────────
  if (phase === 'reveal') {
    const current = purchased[packIdx];
    const isLast = packIdx === purchased.length - 1;
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
            <button
              onClick={onBackToMain}
              className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
            >
              ← 메인
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">자판기깡</h1>
              <p className="mt-1 truncate text-xs text-gray-500">팩 {packIdx + 1} / {purchased.length}</p>
            </div>
          </div>
          <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-gray-800 sm:ml-2 sm:min-w-32">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${((packIdx + 1) / purchased.length) * 100}%` }}
            />
          </div>
            {accountBar ? <div className="w-full sm:ml-auto sm:w-auto">{accountBar}</div> : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest">{current.setMeta.name_ko}</p>
            <h2 className="text-2xl font-black mt-1">자판기 1팩</h2>
          </div>

          <div className="grid grid-cols-5 gap-3 sm:gap-4 w-full">
            {current.pack.cards.map((card, i) => (
              <CardTile
                key={i}
                card={card}
                onClick={() => openCard(card, current.setCode)}
                premiumSparkle={isPremiumSparkleRarity(card.rarity, card)}
              />
            ))}
          </div>

          <button
            onClick={handleNextPack}
            className="mt-4 px-10 py-3.5 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 rounded-xl font-bold text-lg transition shadow-lg shadow-amber-900/40"
          >
            {isLast ? '결과 보기 →' : '다음 팩 →'}
          </button>
        </main>

        {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}
      </div>
    );
  }

  // ─────────────────────────── DONE ───────────────────────────
  if (phase === 'done') {
    const allCards = purchased.flatMap((p) => p.pack.cards);
    const sorted = sortByRarity(allCards);
    const hits = getHitCounts(allCards);
    const totalCostFinal = purchased.reduce((s, p) => s + (p.setMeta.pack_price_krw ?? 0), 0);
    const purchasedSetCodes = Array.from(new Set(purchased.map((pack) => pack.setCode)));
    const luckTargetSetCode = purchasedSetCodes.length === 1 ? purchasedSetCodes[0] : undefined;
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
            <button
              onClick={onBackToMain}
              className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
            >
              ← 메인
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">자판기깡 결과</h1>
              <p className="mt-1 truncate text-xs text-gray-500">총 {purchased.length}팩 개봉</p>
            </div>
          </div>
            {accountBar ? <div className="w-full sm:ml-auto sm:w-auto">{accountBar}</div> : null}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
          <section className="mb-6 text-sm text-gray-300 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-gray-500">이번 개봉</span>
            <span>총 {purchased.length}팩</span>
            <span className="text-gray-700">·</span>
            <span>{totalCostFinal.toLocaleString()}원</span>
            {hits.map(({ rarity, count, sample }) => (
              <span key={rarity} className={RARITY_TEXT_COLOR[rarity]}>
                · {rarityLabel(rarity, sample)} {count}장
              </span>
            ))}
          </section>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {sorted.map((c, i) => (
              <CardTile
                key={i}
                card={c}
                onClick={() => openCard(c, purchased.find((p) => p.pack.cards.includes(c))?.setCode)}
                premiumSparkle={isPremiumSparkleRarity(c.rarity, c)}
              />
            ))}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button
              onClick={handleRestart}
              className="px-8 py-3 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 rounded-xl font-bold transition shadow-lg shadow-amber-900/40"
            >
              다시 개봉하기
            </button>
            <button
              onClick={() => onOpenLuck(luckTargetSetCode)}
              className="px-6 py-3 bg-amber-500/90 text-gray-950 hover:bg-amber-400 active:scale-95 rounded-xl font-black transition shadow-lg shadow-amber-950/20"
            >
              내 운 보러가기
            </button>
            <button
              onClick={onOpenHitDex}
              className="rounded-xl bg-cyan-400/90 px-6 py-3 font-black text-gray-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300 active:scale-95"
            >
              힛카드 기록 보러가기
            </button>
            <button
              onClick={onBackToMain}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl font-bold transition"
            >
              ← 메인
            </button>
          </div>
        </main>

        {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}
      </div>
    );
  }

  // ─────────────────────────── BROWSE (vending grid) ───────────────────────────
  const cartItems = Object.entries(cart)
    .map(([code, qty]) => {
      const set = displaySets.find((x) => x.code === code);
      if (!set) return null;
      return { set, qty };
    })
    .filter((x): x is { set: SetMeta; qty: number } => x !== null);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
          <button
            onClick={onBackToMain}
            className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
          >
            ← 메인
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">자판기깡</h1>
            <p className="mt-1 truncate text-xs text-gray-500">원하는 팩을 골라 깡하기 · 세트당 최대 {MAX_PER_SET}팩</p>
          </div>
        </div>
          {accountBar ? <div className="w-full sm:ml-auto sm:w-auto">{accountBar}</div> : null}
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="mb-4 rounded-lg bg-gray-900/80 ring-1 ring-yellow-300/30 px-4 py-3">
          <p className="text-[11px] font-black tracking-widest text-yellow-300">NEW · 2026-07-11</p>
          <p className="text-sm font-bold text-white mt-0.5">
            {NEW_SIM_SET_NAMES.join(' · ')}
          </p>
        </div>

        <div className="mb-4">
          <label className="sr-only" htmlFor="vending-search">
            팩 검색
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              id="vending-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="팩 이름 검색"
              className="h-12 w-full rounded-xl border border-white/10 bg-gray-900/80 pl-12 pr-24 text-base font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-yellow-300/60 focus:bg-gray-900"
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              <span className="text-[11px] font-black text-gray-500">
                {visibleSets.length}/{isSearching ? displaySets.length : seriesSets.length}
              </span>
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-sm font-black text-gray-300 transition hover:bg-white/15 hover:text-white"
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <SetSeriesTabs
            sets={displaySets}
            active={selectedSeries}
            onChange={(series) => {
              setActiveSeries(series);
              setQuery('');
            }}
            tone="vending"
          />
        </div>

        {/* 자판기 본체 — 노란 프레임 → 검정 패널 → 파란 LCD */}
        <div className="rounded-[28px] bg-gradient-to-br from-yellow-400 to-yellow-500 p-3 sm:p-4 shadow-2xl ring-1 ring-yellow-300/50">
          <div className="rounded-3xl bg-gradient-to-b from-gray-950 to-black p-3 sm:p-5 shadow-inner">
            {/* 브랜드 헤더 */}
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 px-2">
              <PikachuMascot src="/pikachu.webp" />
              <div className="flex flex-col items-center min-w-0">
                <h2
                  className="text-2xl sm:text-4xl font-black tracking-wider leading-none"
                  style={{
                    color: '#FFCB05',
                    WebkitTextStroke: '1.5px #2A75BB',
                    textShadow: '0 3px 0 #2A75BB, 0 5px 8px rgba(0,0,0,0.6)',
                    letterSpacing: '0.05em',
                  }}
                >
                  POKÉSIM
                </h2>
                <p className="text-[10px] sm:text-xs font-bold text-yellow-300 mt-1 flex items-center gap-1.5 tracking-wide">
                  <MonsterBall className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline-block" />
                  카드팩 시뮬레이터
                  <MonsterBall className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline-block" />
                </p>
              </div>
              <PikachuMascot src="/pikachu.webp" flip />
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 p-3 sm:p-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {visibleSets.map((set) => {
                const inCart = cart[set.code] ?? 0;
                const isNew = isNewSimSet(set.code);
                return (
                  <button
                    key={set.code}
                    onClick={() => openModal(set)}
                    className="group relative rounded-xl bg-gradient-to-b from-sky-300/95 to-blue-200/95 hover:from-sky-200 hover:to-blue-100 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-lg ring-1 ring-blue-300/50 overflow-hidden flex flex-col"
                  >
                    {inCart > 0 && (
                      <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center shadow-lg ring-2 ring-white">
                        {inCart}
                      </div>
                    )}
                    {isNew && (
                      <div className="absolute top-2 right-2 z-10 rounded bg-yellow-300 px-1.5 py-0.5 text-[9px] font-black text-gray-950 shadow">
                        NEW
                      </div>
                    )}
                    <div className="relative aspect-[3/4] w-full bg-white/30 overflow-hidden">
                      <Image
                        src={getBoxThumbnailImageSrc(set.code)}
                        alt={set.name_ko}
                        fill
                        sizes="(max-width: 640px) 30vw, (max-width: 1024px) 22vw, 17vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="px-1.5 pb-2 pt-1">
                      <p className="mb-1 h-8 overflow-hidden text-center text-[10px] font-black leading-4 text-gray-950">
                        {set.name_ko}
                      </p>
                      <div className="rounded-full bg-gray-900 text-white text-center py-1 font-black text-xs tabular-nums">
                        ₩{set.pack_price_krw.toLocaleString()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {visibleSets.length === 0 && (
              <div className="rounded-xl border border-dashed border-blue-100/25 bg-blue-950/35 px-4 py-8 text-center">
                <p className="text-sm font-black text-blue-100">검색 결과가 없습니다</p>
              </div>
            )}
            <p className="text-center text-xs text-blue-200/80 mt-4 tracking-wide">
              ▼ 시뮬레이션할 팩을 골라보세요 (실제 결제 없음) ▼
            </p>
            </div>
            {/* 하단 안내 (실제 자판기의 관리자 정보 영역 모방) */}
            <div className="mt-3 px-2 flex items-center justify-between text-[10px] text-gray-500">
              <a
                href="https://open.kakao.com/o/sqFZE7ti"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative hover:text-gray-300 transition-colors cursor-pointer"
              >
                📞 관리자 호출하기
                <span className="absolute bottom-full mb-1 left-0 hidden group-hover:block w-max bg-gray-800 text-gray-200 text-[10px] px-2 py-1.5 rounded ring-1 ring-white/10 shadow-xl z-50">
                  버그 제보, 문의, 피드백 모두 감사히 받겠습니다! 🙇‍♂️
                </span>
              </a>
              <span className="font-mono">v.1.0</span>
            </div>
          </div>
        </div>

        {/* 장바구니 */}
        {cartItems.length > 0 && (
          <section className="mt-6 rounded-2xl bg-gray-900/80 ring-1 ring-white/10 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-300 tracking-wider">🛒 장바구니</h2>
              <span className="text-xs text-gray-500">총 {totalPacks}개 · {totalCost.toLocaleString()}원</span>
            </div>
            <ul className="space-y-2">
              {cartItems.map(({ set, qty }) => (
                <li key={set.code} className="flex items-center gap-3 text-sm">
                  <div className="relative w-10 h-12 shrink-0 rounded bg-gray-800 overflow-hidden">
                    <Image
                      src={getBoxThumbnailImageSrc(set.code)}
                      alt={set.name_ko}
                      fill
                      sizes="40px"
                      className="object-contain p-0.5"
                    />
                  </div>
                  <span className="flex-1 truncate font-medium">{set.name_ko}</span>
                  <span className="text-gray-400 tabular-nums">× {qty}팩</span>
                  <span className="text-white font-bold tabular-nums w-24 text-right">
                    {((set.pack_price_krw ?? 0) * qty).toLocaleString()}원
                  </span>
                  <button
                    onClick={() => handleRemoveFromCart(set.code)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-xs px-2"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleCheckout}
              className="mt-4 w-full py-3.5 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 active:scale-[0.99] rounded-xl font-black text-lg transition shadow-lg shadow-green-900/40"
            >
              개봉 시작 ({totalCost.toLocaleString()}원 어치)
            </button>
          </section>
        )}
      </main>

      {/* 수량 모달 */}
      {modalSet && (
        <QuantityModal
          set={modalSet}
          qty={modalQty}
          maxAllowed={MAX_PER_SET}
          onIncrement={modalIncrement}
          onDecrement={modalDecrement}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onClose={closeModal}
        />
      )}

      {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}
    </div>
  );
}

function QuantityModal({
  set,
  qty,
  maxAllowed,
  onIncrement,
  onDecrement,
  onAddToCart,
  onBuyNow,
  onClose,
}: {
  set: SetMeta;
  qty: number;
  maxAllowed: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onClose: () => void;
}) {
  const total = (set.pack_price_krw ?? 0) * qty;
  const remaining = Math.max(0, maxAllowed - qty);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-gradient-to-br from-sky-100 to-blue-100 text-gray-900 shadow-2xl ring-2 ring-yellow-400 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 flex items-center gap-4 bg-white/40">
          <div className="relative w-20 h-24 shrink-0 rounded-lg bg-white/60 overflow-hidden ring-1 ring-blue-200">
            <Image
              src={getBoxThumbnailImageSrc(set.code)}
              alt={set.name_ko}
              fill
              sizes="80px"
              className="object-contain p-1"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700/70 tracking-wider">
              {set.type === 'hi-class' ? '하이클래스팩' : set.type === 'starter' ? '스타트덱' : '확장팩'}
            </p>
            <h2 className="text-lg font-black truncate">{set.name_ko}</h2>
            <p className="text-sm font-bold text-gray-700 tabular-nums">
              ₩{(set.pack_price_krw ?? 0).toLocaleString()} / 팩
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xs text-blue-700/80 mb-2">수량</span>
            <div className="flex items-center gap-3">
              <button
                onClick={onDecrement}
                disabled={qty <= 0}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-2xl font-black shadow-md active:scale-95 transition"
                aria-label="수량 감소"
              >
                −
              </button>
              <span className="text-3xl font-black w-10 text-center tabular-nums">{qty}</span>
              <button
                onClick={onIncrement}
                disabled={qty >= maxAllowed}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-2xl font-black shadow-md active:scale-95 transition"
                aria-label="수량 증가"
              >
                ＋
              </button>
            </div>
            <span className="text-[11px] text-blue-700/60 mt-1">남은 수량 {remaining}개</span>
          </div>

          <div className="text-right">
            <p className="text-xs text-blue-700/70 mb-1">합계</p>
            <p className="text-2xl font-black tabular-nums">₩{total.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-2 gap-3 bg-white/50 border-t border-blue-200/60">
          <button
            onClick={onAddToCart}
            disabled={qty <= 0 && !set.code}
            className="py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] font-black text-gray-900 shadow-md transition"
          >
            🛒 장바구니
          </button>
          <button
            onClick={onBuyNow}
            disabled={qty <= 0}
            className="py-3 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] font-black text-white shadow-md transition"
          >
            ✓ 바로 개봉
          </button>
        </div>

        <button
          onClick={onClose}
          className="block w-full py-2 text-xs text-gray-500 hover:text-gray-800 hover:bg-white/40 transition"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function PikachuMascot({ src, flip = false }: { src: string; flip?: boolean }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span
        className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 ring-2 ring-yellow-200 shadow-lg shrink-0 select-none text-2xl sm:text-3xl"
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
        aria-hidden
      >
        ⚡
      </span>
    );
  }
  return (
    <span
      className="relative w-14 h-14 sm:w-20 sm:h-20 shrink-0 select-none"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="80px"
        className="object-contain"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 0 8px rgba(255,255,255,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
        onError={() => setErrored(true)}
      />
    </span>
  );
}

function MonsterBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#CC0000" stroke="#222" strokeWidth="1.5" />
      <path d="M1 12 Q1 12 23 12" stroke="#222" strokeWidth="1.5" />
      <rect x="1" y="11" width="22" height="2" fill="#222" />
      <circle cx="12" cy="12" r="11" fill="none" clipPath="url(#bot)" />
      <clipPath id="bot">
        <rect x="0" y="12" width="24" height="12" />
      </clipPath>
      <circle cx="12" cy="12" r="11" fill="white" clipPath="url(#bot2)" />
      <clipPath id="bot2">
        <rect x="0" y="13.5" width="24" height="12" />
      </clipPath>
      <circle cx="12" cy="12" r="3.5" fill="white" stroke="#222" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.8" fill="#aaa" />
    </svg>
  );
}

function CardTile({
  card,
  onClick,
  premiumSparkle = false,
}: {
  card: Card;
  onClick?: () => void;
  premiumSparkle?: boolean;
}) {
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const Wrapper = onClick ? 'button' : 'div';
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;
  const premiumSparkleRarity = premiumSparkle && showImage ? premiumSparkleVariant(card.rarity, card) : null;
  return (
    <Wrapper
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      className={`card-image-frame relative aspect-[5/7] rounded-lg overflow-hidden block w-full bg-gray-800 select-none ${premiumSparkleRarity ? `premium-hit-card premium-hit-card--${premiumSparkleRarity}` : ''} ${glow} ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''}`}
      data-watermark={showImage ? 'pokesim.kr' : undefined}
    >
      {!showImage ? (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-2 text-center">
          <span className="text-[10px] text-gray-400 leading-tight">{card.name_ko ?? card.card_num}</span>
          {card.rarity && <span className="text-[9px] text-gray-500 mt-1">{card.rarity}</span>}
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 bg-gray-800 animate-pulse" />}
          <Image
            src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 256 })}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes="(max-width: 640px) 30vw, (max-width: 1024px) 18vw, 150px"
            className="object-cover"
            unoptimized
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!useOriginal && CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED) {
                setUseOriginal(true);
                setLoaded(false);
              } else {
                setErrored(true);
              }
            }}
          />
          {premiumSparkleRarity && (
            <span
              className={`premium-hit-sparkle premium-hit-sparkle--${premiumSparkleRarity}`}
              aria-hidden="true"
            >
              <span className="premium-hit-sparkle__dust" />
            </span>
          )}
        </>
      )}
      {card.rarity && (
        <span
          className={`absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'} z-10`}
        >
          {rarityLabel(card.rarity, card)}
        </span>
      )}
    </Wrapper>
  );
}
