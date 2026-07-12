'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { Card, SetMeta } from '../lib/types';
import { simulateStartDeck, type StartDeckResult } from '../lib/simulation/starter';
import { createLuckOpening, summarizeLuckEvent } from '../lib/luck';
import { getBoxImageSrc } from '../lib/boxImages';
import { CardModal } from './CardModal';
import { trackSim, trackUserEvent } from '../lib/statsTracker';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import {
  createOpeningEvent,
  EMPTY_OPENING_SESSION,
  normalizeOpeningSession,
  SESSION_STORAGE_KEY,
  type OpeningSession,
} from '../lib/openingHistory';
import { addCardsToHitDex } from '../lib/hitDex';
import { CARD_GLOW, RARITY_BADGE, premiumSparkleVariant, rarityLabel } from '../lib/rarity';

type Phase = 'idle' | 'reveal';
type OpenLuckMode = 'box' | 'pack';

const EMPTY_SESSION: OpeningSession = EMPTY_OPENING_SESSION;

function loadStoredSession(): OpeningSession {
  if (typeof window === 'undefined') return EMPTY_SESSION;
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return EMPTY_SESSION;
    return normalizeOpeningSession(JSON.parse(stored));
  } catch {
    /* corrupt — fall through */
  }
  return EMPTY_SESSION;
}

function DeckCard({
  card,
  onClick,
  priority = false,
}: {
  card: Card;
  onClick?: () => void;
  priority?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;
  const glow = card.rarity ? (CARD_GLOW[card.rarity] ?? '') : '';
  const premiumSparkleRarity = showImage ? premiumSparkleVariant(card.rarity, card) : null;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      className={`card-image-frame relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-gray-800 ring-1 ring-white/10 select-none block ${premiumSparkleRarity ? `premium-hit-card premium-hit-card--${premiumSparkleRarity}` : ''} ${glow} ${onClick ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''}`}
      data-watermark={showImage ? 'pokesim.kr' : undefined}
    >
      {!showImage ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-2 text-center">
          <span className="text-xs leading-tight text-gray-300">{card.name_ko ?? card.card_num}</span>
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-800" />}
          <Image
            src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 512 })}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes="(max-width: 640px) 60vw, 320px"
            className="object-cover"
            priority={priority}
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
          className={`absolute bottom-1.5 right-1.5 z-10 rounded px-1.5 py-0.5 text-[11px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}
        >
          {rarityLabel(card.rarity, card)}
        </span>
      )}
    </Wrapper>
  );
}

function SessionBar({ session, onReset }: { session: OpeningSession; onReset: () => void }) {
  if (session.packs === 0) return null;
  const specials = session.openingEvents.filter((event) => (event.rarityCounts.UR ?? 0) > 0 || event.cardCount > 1).length;
  const handleReset = () => {
    if (window.confirm('지금까지 뽑은 기록을 모두 초기화할까요?\n힛카드 도감은 유지됩니다.')) onReset();
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-3 rounded-lg bg-gray-900/50 px-4 py-2.5 text-[11px] text-gray-400 ring-1 ring-white/5">
      <span className="min-w-0">
        지금까지 뽑은 덱: <span className="font-bold text-white">{session.packs}</span>개
        {' · '}<span className="font-bold tabular-nums text-white">{session.cost.toLocaleString()}원</span>
        {specials > 0 && (
          <span className="text-amber-300">{' · '}✨ 스페셜/골드 <span className="font-bold">{specials}</span></span>
        )}
      </span>
      <button
        onClick={handleReset}
        className="shrink-0 text-[10px] text-gray-500 underline-offset-2 transition-colors hover:text-red-400 hover:underline"
      >
        리셋
      </button>
    </div>
  );
}

export function StartDeckSimulator({
  setMeta,
  onChangeSet,
  onOpenLuck,
}: {
  setMeta: SetMeta;
  onChangeSet: () => void;
  onOpenLuck: (mode: OpenLuckMode) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<StartDeckResult | null>(null);
  const [session, setSession] = useState<OpeningSession>(EMPTY_SESSION);
  const [hydrated, setHydrated] = useState(false);
  const [modalCard, setModalCard] = useState<Card | null>(null);
  const [boxImgErr, setBoxImgErr] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(loadStoredSession());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* quota / 비공개 모드 — 무시 */
    }
  }, [session, hydrated]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhase('idle');
      setResult(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setMeta.code]);

  const resetSession = useCallback(() => setSession(EMPTY_SESSION), []);

  const drawDeck = useCallback(() => {
    if (!setMeta.start_deck) return;
    const drawn = simulateStartDeck(setMeta.cards, setMeta.start_deck);
    setResult(drawn);
    setPhase('reveal');

    // 스타트덱 대표카드는 전부 AR 이상(가치 있는 카드)이라 뽑은 카드를 모두 hit으로 본다.
    // (getOpeningHitCards는 AR을 hit에서 제외하므로, 가치 기반 운 계산을 위해 직접 채운다.)
    const event = {
      ...createOpeningEvent({
        setMeta,
        unit: 'pack',
        source: 'box-simulator',
        cards: drawn.cards,
        boxCount: 0,
        packCount: 1,
        krw: setMeta.box_price_krw,
      }),
      hitCards: drawn.cards,
    };
    addCardsToHitDex(drawn.cards, setMeta);
    setSession((s) => ({
      ...s,
      packs: s.packs + 1,
      cost: s.cost + setMeta.box_price_krw,
      cards: [...s.cards, ...drawn.cards],
      openingEvents: [...s.openingEvents, event],
    }));

    const opening = createLuckOpening(setMeta, { packs: 1 });
    trackSim({
      setCode: setMeta.code,
      mode: 'pack',
      boxCount: 0,
      packCount: 1,
      krw: setMeta.box_price_krw,
      luck: summarizeLuckEvent(drawn.cards, opening, setMeta),
    });
    trackUserEvent({
      eventName: 'open_again',
      setCode: setMeta.code,
      mode: 'pack',
      metadata: { starter: true, special: drawn.isSpecial, gold: drawn.isGold },
    });
  }, [setMeta]);

  const openCardModal = useCallback(
    (card: Card) => {
      trackUserEvent({ eventName: 'open_card_modal', setCode: setMeta.code, mode: 'box', rarity: card.rarity ?? null });
      setModalCard(card);
    },
    [setMeta.code],
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-800/80 px-6 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={onChangeSet}
            className="shrink-0 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            ← 세트 선택
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">PokéSim KR</h1>
            <p className="mt-1 truncate text-xs text-gray-400">{setMeta.name_ko}</p>
          </div>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={() => {
              setPhase('idle');
              setResult(null);
            }}
            className="text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            처음으로
          </button>
        )}
      </header>

      <main className="flex-1">
        {phase === 'idle' && (
          <div className="flex min-h-[calc(100vh-72px)] flex-col items-center gap-6 px-4 py-8">
            <div className="flex max-w-xl flex-col items-center text-center">
              <div className="relative mb-4 h-64 w-52 overflow-hidden rounded-2xl sm:h-80 sm:w-64">
                {!boxImgErr ? (
                  <Image
                    src={getBoxImageSrc(setMeta.code)}
                    alt={setMeta.name_ko}
                    fill
                    sizes="280px"
                    className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
                    onError={() => setBoxImgErr(true)}
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-800 p-4 text-center">
                    <span className="text-2xl font-black leading-tight text-white/90">{setMeta.name_ko}</span>
                  </div>
                )}
              </div>
              <p className="mb-1 text-2xl font-black tracking-tight sm:text-3xl">{setMeta.name_ko}</p>
              <p className="text-xs text-gray-500">
                {setMeta.cards.length}종 · 60장 구축 덱 · 스타트 덱
              </p>
            </div>

            <SessionBar session={session} onReset={resetSession} />

            <section className="w-full max-w-2xl">
              <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
                스타트 덱 뽑기 · ₩{setMeta.box_price_krw.toLocaleString()}
              </h3>
              <button
                onClick={drawDeck}
                className="flex w-full flex-col gap-1 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 py-8 text-lg font-bold shadow-xl shadow-blue-900/40 transition hover:from-cyan-400 hover:to-blue-600 active:scale-95"
              >
                덱 뽑기
                <span className="text-[11px] font-normal text-cyan-100/90">
                  {(setMeta.start_deck?.deck_count ?? 100).toLocaleString()}개 덱 중 무작위 1개 · 대표 카드 공개
                </span>
              </button>
            </section>

            <p className="mt-2 max-w-md text-center text-[11px] leading-relaxed text-gray-600">
              ⓘ 대표카드 구성은 ex/메가 ex 기반 추정입니다. 공식 덱 구성·봉입률은 비공개입니다.
            </p>
          </div>
        )}

        {phase === 'reveal' && result && (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
            {result.isGold ? (
              <div className="text-center">
                <p className="text-sm font-black tracking-widest text-yellow-300">✨ 골드 덱 · No.{result.deckNo}</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">MUR 대표 카드!</h2>
              </div>
            ) : result.isSpecial ? (
              <div className="text-center">
                <p className="text-sm font-black tracking-widest text-amber-300">✨ 스페셜 덱 · No.{setMeta.start_deck?.special_deck_no ?? 101}</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">대표 카드 3장!</h2>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs font-black tracking-widest text-gray-500">스타트 덱</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">No.{result.deckNo}</h2>
              </div>
            )}

            <div
              className={`grid w-full gap-4 ${result.cards.length > 1 ? 'max-w-2xl grid-cols-3' : 'max-w-[260px] grid-cols-1'}`}
            >
              {result.cards.map((card, i) => (
                <div key={i} className={result.isSpecial || result.isGold ? 'card-reveal-hit' : 'card-reveal'} style={{ animationDelay: `${i * 140}ms` }}>
                  <DeckCard card={card} onClick={() => openCardModal(card)} priority />
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={drawDeck}
                className="rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 px-10 py-3 font-bold shadow-lg shadow-blue-900/40 transition hover:from-cyan-500 hover:to-blue-600 active:scale-95"
              >
                한 번 더 뽑기
              </button>
              <button
                onClick={() => onOpenLuck('pack')}
                className="rounded-xl bg-amber-500/90 px-6 py-3 font-black text-gray-950 shadow-lg shadow-amber-950/20 transition hover:bg-amber-400 active:scale-95"
              >
                운 확인하러가기
              </button>
              <button
                onClick={onChangeSet}
                className="rounded-xl bg-gray-800 px-6 py-3 font-bold transition hover:bg-gray-700 active:scale-95"
              >
                ← 다른 박스 선택
              </button>
            </div>

            <SessionBar session={session} onReset={resetSession} />

            <p className="mt-2 text-center text-[11px] text-gray-600">
              ⓘ 대표카드 구성은 ex/메가 ex 기반 추정입니다. 공식 덱 구성·봉입률은 비공개입니다.
            </p>
            <p className="text-center font-mono text-[10px] text-gray-700 break-all">seed: {result.seed}</p>
          </div>
        )}
      </main>

      {modalCard && <CardModal card={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );
}
