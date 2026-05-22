'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Card, SetMeta } from '../lib/types';
import {
  createLuckOpening,
  scoreLuckSummaries,
  summarizeLuckRarityCounts,
  type WeightedLuckScore,
} from '../lib/luck';
import {
  EMPTY_OPENING_SESSION,
  getOpeningHitCards,
  normalizeOpeningSession,
  SESSION_STORAGE_KEY,
  type OpeningSession,
} from '../lib/openingHistory';
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
  rarityLabel,
  sortByRarity,
} from '../lib/rarity';
import { LuckPyramid } from './LuckPyramid';
import { CardModal } from './CardModal';

function loadSession(): OpeningSession {
  if (typeof window === 'undefined') return EMPTY_OPENING_SESSION;
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return EMPTY_OPENING_SESSION;
    return normalizeOpeningSession(JSON.parse(stored));
  } catch {
    return EMPTY_OPENING_SESSION;
  }
}

function saveSession(session: OpeningSession): void {
  if (typeof window === 'undefined') return;
  if (session.cards.length === 0 && session.openingEvents.length === 0) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function removeSetFromSession(session: OpeningSession, set: SetMeta): OpeningSession {
  const setCardNums = new Set(set.cards.map((card) => card.card_num));
  const openingEvents = session.openingEvents.filter((event) => event.setCode !== set.code);
  const cards = session.cards.filter((card) => !setCardNums.has(card.card_num));

  return {
    boxes: openingEvents.reduce((sum, event) => sum + event.boxCount, 0),
    packs: openingEvents.reduce((sum, event) => sum + (event.unit === 'pack' ? event.packCount : 0), 0),
    cost: openingEvents.reduce((sum, event) => sum + event.krw, 0),
    cards,
    openingEvents,
  };
}

function getSetHitCards(cards: Card[], set: SetMeta): Card[] {
  const setCardNums = new Set(set.cards.map((card) => card.card_num));
  return getOpeningHitCards(cards.filter((card) => setCardNums.has(card.card_num)));
}

export function LuckScreen({
  sets,
  initialSetCode,
  onBackToMain,
}: {
  sets: SetMeta[];
  initialSetCode?: string | null;
  onBackToMain: () => void;
}) {
  const [session, setSession] = useState<OpeningSession>(EMPTY_OPENING_SESSION);
  const [selectedSetCode, setSelectedSetCode] = useState<string | null>(initialSetCode ?? null);
  const [openHitCardsSetCode, setOpenHitCardsSetCode] = useState<string | null>(null);
  const [setListOpen, setSetListOpen] = useState(false);
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(loadSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setByCode = useMemo(() => new Map(sets.map((set) => [set.code, set])), [sets]);
  const setBreakdowns = useMemo(() => {
    const groups = new Map<string, {
      set: SetMeta;
      boxes: number;
      packs: number;
      eventIds: string[];
      hitCards: Card[];
      missingHitCards: boolean;
      summaries: ReturnType<typeof summarizeLuckRarityCounts>[];
    }>();

    for (const event of session.openingEvents) {
      const set = setByCode.get(event.setCode);
      if (!set) continue;
      const group = groups.get(event.setCode) ?? {
        set,
        boxes: 0,
        packs: 0,
        eventIds: [],
        hitCards: [],
        missingHitCards: false,
        summaries: [],
      };
      group.boxes += event.boxCount;
      group.packs += event.unit === 'pack' ? event.packCount : 0;
      group.eventIds.push(event.id);
      if (Array.isArray(event.hitCards)) {
        group.hitCards.push(...event.hitCards);
      } else {
        group.missingHitCards = true;
      }
      group.summaries.push(
        summarizeLuckRarityCounts(
          event.rarityCounts,
          createLuckOpening(set, {
            boxes: event.boxCount,
            packs: event.unit === 'pack' ? event.packCount : 0,
          }),
          set,
        ),
      );
      groups.set(event.setCode, group);
    }

    return Array.from(groups.values()).map((group) => {
      const hitCards = group.missingHitCards ? getSetHitCards(session.cards, group.set) : group.hitCards;
      return {
        ...group,
        hitCards: sortByRarity(hitCards),
        score: scoreLuckSummaries(group.summaries),
      };
    });
  }, [session.cards, session.openingEvents, setByCode]);
  const activeBreakdown = setBreakdowns.find((group) => group.set.code === selectedSetCode) ?? setBreakdowns[0] ?? null;
  const hitCardsOpen = Boolean(activeBreakdown && openHitCardsSetCode === activeBreakdown.set.code);
  const hits = getHitCounts(session.cards);
  const hasHistory = session.cards.length > 0 || session.openingEvents.length > 0;

  function handleResetAllSession() {
    const confirmed = window.confirm('전체 기록을 초기화할까요?');
    if (!confirmed) return;

    saveSession(EMPTY_OPENING_SESSION);
    setSession(EMPTY_OPENING_SESSION);
    setSelectedSetCode(null);
    setOpenHitCardsSetCode(null);
    setSetListOpen(false);
  }

  function handleResetActiveSet() {
    if (!activeBreakdown) return;
    const confirmed = window.confirm(`${activeBreakdown.set.name_ko} 기록만 초기화할까요?`);
    if (!confirmed) return;

    const nextSession = removeSetFromSession(session, activeBreakdown.set);
    saveSession(nextSession);
    setSession(nextSession);
    setSelectedSetCode(null);
    setOpenHitCardsSetCode(null);
    setSetListOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <button
            onClick={onBackToMain}
            className="shrink-0 rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            메인
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight">내 운 확인</h1>
            <p className="mt-1 text-xs text-gray-500">
              힛카드 수에 대한 확률을 박스 종류별로 계산합니다.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {hasHistory ? (
          <>
            <section className="mb-6 flex flex-wrap gap-2 text-xs font-bold text-gray-400">
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10">
                누적 {session.boxes}박스 · {session.packs}팩
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10">
                {session.cost.toLocaleString()}원
              </span>
              {hits.map(({ rarity, count, sample }) => (
                <span
                  key={rarity}
                  className={`rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10 ${RARITY_TEXT_COLOR[rarity]}`}
                >
                  {rarityLabel(rarity, sample)} {count}
                </span>
              ))}
            </section>

            {setBreakdowns.length > 0 ? (
              <section className="space-y-4">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">박스 종류별 운</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      기대 힛카드 수 대비 실제 힛카드 수를 비교해요.
                    </p>
                  </div>
                  {activeBreakdown && (
                    <button
                      type="button"
                      onClick={handleResetActiveSet}
                      className="w-fit rounded-full px-3 py-1.5 text-xs font-bold text-gray-500 ring-1 ring-white/10 transition hover:bg-red-500/10 hover:text-red-300 hover:ring-red-400/30"
                    >
                      이 박스 기록 초기화
                    </button>
                  )}
                </div>
                {activeBreakdown && (
                  <div className="rounded-2xl bg-white/[0.035] p-1 ring-1 ring-white/10">
                    <button
                      type="button"
                      onClick={() => setSetListOpen((open) => !open)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 text-left text-white ring-1 ring-white/10 transition hover:bg-gray-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-black">{activeBreakdown.set.name_ko}</p>
                        <p className="mt-0.5 text-xs font-bold text-gray-500">
                          {formatOpeningAmount(activeBreakdown.boxes, activeBreakdown.packs)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {activeBreakdown.score ? (
                          <ScoreHitSummary score={activeBreakdown.score} className="max-w-[45vw] truncate text-xs font-black sm:max-w-none" />
                        ) : (
                          <span className="text-xs font-black text-gray-500">계산 불가</span>
                        )}
                        <span
                          className={`h-2 w-2 rotate-45 border-r-2 border-b-2 border-gray-400 transition ${setListOpen ? 'translate-y-1 rotate-[225deg]' : '-translate-y-0.5'}`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    {setListOpen && (
                      <div className="mt-1 overflow-hidden rounded-xl">
                        {setBreakdowns.map((group) => {
                          const isActive = activeBreakdown.set.code === group.set.code;
                          return (
                            <button
                              key={group.set.code}
                              type="button"
                              onClick={() => {
                                setSelectedSetCode(group.set.code);
                                setSetListOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                                isActive
                                  ? 'bg-white/[0.08] text-white'
                                  : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black">{group.set.name_ko}</p>
                                <p className="mt-0.5 text-xs font-bold text-gray-600">
                                  {formatOpeningAmount(group.boxes, group.packs)}
                                </p>
                              </div>
                              {group.score ? (
                                <ScoreHitSummary
                                  score={group.score}
                                  className={`shrink-0 text-xs font-black ${isActive ? '' : 'opacity-70'}`}
                                />
                              ) : (
                                <span className="shrink-0 text-xs font-black text-gray-500">계산 불가</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeBreakdown?.score ? (
                  <>
                    <LuckPyramid
                      score={activeBreakdown.score}
                      seed={activeBreakdown.eventIds.join(':') || activeBreakdown.set.code}
                      title={activeBreakdown.set.name_ko}
                      boxes={activeBreakdown.boxes}
                      packs={activeBreakdown.packs}
                    />
                    <HitCardsPanel
                      cards={activeBreakdown.hitCards}
                      boxes={activeBreakdown.boxes}
                      packs={activeBreakdown.packs}
                      isOpen={hitCardsOpen}
                      onToggle={() => {
                        setOpenHitCardsSetCode((code) => (
                          code === activeBreakdown.set.code ? null : activeBreakdown.set.code
                        ));
                      }}
                      onCardClick={setOpenedCard}
                    />
                  </>
                ) : (
                  <LuckUnavailableMessage onReset={handleResetAllSession} />
                )}
              </section>
            ) : (
              <LuckUnavailableMessage onReset={handleResetAllSession} />
            )}
          </>
        ) : (
          <LuckUnavailableMessage onReset={handleResetAllSession} />
        )}
      </main>

      {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}
    </div>
  );
}

type HitCountPart = {
  rarity: string;
  count: number;
};

function getScoreHitParts(score: WeightedLuckScore): HitCountPart[] {
  const counts: Record<string, number> = {
    ...score.scoreCounts,
    SAR: score.sarCount,
  };
  if (score.topCount > 0 && !counts.MUR && !counts.BWR && !counts.UR) {
    counts['MUR/BWR'] = score.topCount;
  }

  const parts = ['MUR', 'BWR', 'UR', 'HR', 'SAR', 'MA', 'SSR', 'SR']
    .filter((rarity) => (counts[rarity] ?? 0) > 0)
    .map((rarity) => ({ rarity, count: counts[rarity] }));

  if ((counts['MUR/BWR'] ?? 0) > 0) parts.unshift({ rarity: 'MUR/BWR', count: counts['MUR/BWR'] });
  return parts;
}

function ScoreHitSummary({
  score,
  className,
}: {
  score: WeightedLuckScore;
  className?: string;
}) {
  const parts = getScoreHitParts(score);
  if (parts.length === 0) {
    return <span className={`${className ?? ''} text-gray-500`}>히트 없음</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className ?? ''}`}>
      {parts.map((part, index) => (
        <span key={part.rarity} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-gray-700">·</span>}
          <span className={getHitTextColor(part.rarity)}>{part.rarity}</span>
          <span className="text-gray-200">{part.count}</span>
        </span>
      ))}
    </span>
  );
}

function getHitTextColor(rarity: string): string {
  if (rarity === 'MUR/BWR') return RARITY_TEXT_COLOR.MUR;
  return RARITY_TEXT_COLOR[rarity] ?? 'text-gray-200';
}

function formatOpeningAmount(boxes: number, packs: number): string {
  const parts = [];
  if (boxes > 0) parts.push(`${boxes.toLocaleString()}박스`);
  if (packs > 0) parts.push(`${packs.toLocaleString()}팩`);
  return parts.length > 0 ? parts.join(' · ') : '0팩';
}

function HitCardsPanel({
  cards,
  boxes,
  packs,
  isOpen,
  onToggle,
  onCardClick,
}: {
  cards: Card[];
  boxes: number;
  packs: number;
  isOpen: boolean;
  onToggle: () => void;
  onCardClick: (card: Card) => void;
}) {
  const openingAmount = formatOpeningAmount(boxes, packs);

  return (
    <section className="rounded-2xl bg-gray-900/70 p-4 ring-1 ring-white/10 sm:p-5">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[11px] font-black tracking-widest text-gray-500">HIT CARDS</p>
          <h2 className="mt-1 text-lg font-black tracking-tight">
            {openingAmount}에서 나온 SR 이상 힛카드
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white">
          {cards.length}장 {isOpen ? '닫기' : '보기'}
        </span>
      </button>

      {isOpen && (
        cards.length > 0 ? (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {cards.map((card, index) => (
              <CardTile key={`${card.card_num}-${index}`} card={card} onClick={() => onCardClick(card)} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
            기존 기록은 카드 이미지까지 저장되지 않았거나, 확률 계산에 반영된 힛카드가 없어요.
          </p>
        )
      )}
    </section>
  );
}

function LuckUnavailableMessage({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center">
      <p className="text-lg font-black text-white">운 계산용 기록이 없어요</p>
      <p className="mt-2 text-sm text-gray-500">
        예전 세션은 운 확인에 필요한 박스별 기록이 없을 수 있어요.
        전체 기록을 초기화하고 새로 까면 내 운 확인이 정상적으로 계산됩니다.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 rounded-full bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 ring-1 ring-red-400/25 transition hover:bg-red-500/15 hover:ring-red-300/50"
      >
        전체 기록 초기화
      </button>
    </div>
  );
}

function CardTile({ card, onClick }: { card: Card; onClick?: () => void }) {
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`card-image-frame relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-800 select-none block w-full ${glow} ${onClick ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''}`}
      data-watermark={showImage ? 'pokesim.kr' : undefined}
      onContextMenu={(event) => event.preventDefault()}
    >
      {!showImage ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          <span className="text-[9px] leading-tight text-gray-400">{card.name_ko ?? card.card_num}</span>
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-800" />}
          <Image
            src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 256 })}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes="10vw"
            className="object-cover"
            unoptimized
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
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
        </>
      )}
      {card.rarity && (
        <span
          className={`absolute bottom-0.5 right-0.5 z-10 rounded px-1 py-px text-[9px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}
        >
          {rarityLabel(card.rarity, card)}
        </span>
      )}
    </Wrapper>
  );
}
