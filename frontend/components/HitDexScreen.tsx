'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Card, SetMeta } from '../lib/types';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import {
  PREMIUM_HIT_PRICE_TIERS_KRW,
  RARITY_BADGE,
  rarityLabel,
} from '../lib/rarity';
import { getCardReferenceValueKrw } from '../lib/valueLuck';
import {
  getSetSeriesKey,
  SET_SERIES,
  type SetSeriesKey,
} from '../lib/setSeries';
import {
  getHitDexCardKey,
  isFeaturedHitDexCard,
  isHitDexCard,
  type HitDexEntry,
  type HitDexState,
} from '../lib/hitDex';
import { CardModal } from './CardModal';

const HIT_DEX_EFFECT_MIN_PRICE_KRW = 70_000;

interface HitDexCatalogItem {
  key: string;
  set: SetMeta;
  card: Card;
  entry: HitDexEntry | null;
}

interface HitDexSetSection {
  set: SetMeta;
  cards: HitDexCatalogItem[];
  registeredCount: number;
}

interface HitDexEraSummary {
  key: SetSeriesKey;
  label: string;
  shortLabel: string;
  totalCards: number;
  registeredCards: number;
  setCount: number;
}

type HitDexEffectVariant = 'value' | 'rare' | 'jackpot';

function buildEraSummaries(sections: HitDexSetSection[]): HitDexEraSummary[] {
  return SET_SERIES.map((era) => {
    const eraSections = sections.filter((section) => getSetSeriesKey(section.set) === era.key);
    return {
      ...era,
      totalCards: eraSections.reduce((sum, section) => sum + section.cards.length, 0),
      registeredCards: eraSections.reduce((sum, section) => sum + section.registeredCount, 0),
      setCount: eraSections.length,
    };
  }).filter((era) => era.totalCards > 0);
}

function progressPercent(registered: number, total: number): number {
  return total > 0 ? Math.round((registered / total) * 100) : 0;
}

function sortCatalogCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const numberDiff = (a.number ?? 0) - (b.number ?? 0);
    if (numberDiff !== 0) return numberDiff;
    return (a.name_ko ?? '').localeCompare(b.name_ko ?? '');
  });
}

function buildCatalog(sets: SetMeta[], hitDex: HitDexState): HitDexSetSection[] {
  const entriesByKey = new Map(hitDex.entries.map((entry) => [entry.key, entry]));

  return sets
    .map((set) => {
      const cards = sortCatalogCards(set.cards.filter((card) => isHitDexCard(card, set.code))).map((card) => {
        const key = getHitDexCardKey(card, set.code);
        return {
          key,
          set,
          card,
          entry: entriesByKey.get(key) ?? null,
        };
      });

      return {
        set,
        cards,
        registeredCount: cards.filter((item) => item.entry).length,
      };
    })
    .filter((section) => section.cards.length > 0);
}

function hitDexEffectVariant(priceKrw: number): HitDexEffectVariant {
  if (priceKrw >= PREMIUM_HIT_PRICE_TIERS_KRW.jackpot) return 'jackpot';
  if (priceKrw >= PREMIUM_HIT_PRICE_TIERS_KRW.rare) return 'rare';
  return 'value';
}

function hitDexEffectLimit(cardCount: number): number {
  if (cardCount >= 40) return 6;
  if (cardCount >= 24) return 5;
  if (cardCount >= 12) return 4;
  if (cardCount >= 8) return 3;
  return 2;
}

function buildHitDexEffectVariants(sections: HitDexSetSection[]): Map<string, HitDexEffectVariant> {
  const effects = new Map<string, HitDexEffectVariant>();

  for (const section of sections) {
    const pricedCards = section.cards
      .map((item) => ({
        item,
        priceKrw: getCardReferenceValueKrw(item.card, section.set.code),
      }))
      .filter(({ priceKrw }) => priceKrw >= HIT_DEX_EFFECT_MIN_PRICE_KRW)
      .sort((a, b) => {
        const priceDiff = b.priceKrw - a.priceKrw;
        if (priceDiff !== 0) return priceDiff;
        return a.item.card.number - b.item.card.number;
      });

    const topCards = pricedCards.slice(0, hitDexEffectLimit(section.cards.length));
    for (const topCard of topCards) {
      effects.set(topCard.item.key, hitDexEffectVariant(topCard.priceKrw));
    }

    for (const item of section.cards) {
      if (!isFeaturedHitDexCard(item.card, section.set.code)) continue;
      const priceKrw = getCardReferenceValueKrw(item.card, section.set.code);
      effects.set(item.key, hitDexEffectVariant(priceKrw));
    }
  }

  return effects;
}

export function HitDexScreen({
  sets,
  hitDex,
  onBackToMain,
  backupBar,
}: {
  sets: SetMeta[];
  hitDex: HitDexState;
  onBackToMain: () => void;
  backupBar?: ReactNode;
}) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [unknownItem, setUnknownItem] = useState<HitDexCatalogItem | null>(null);
  const [activeEra, setActiveEra] = useState<SetSeriesKey>('mega');
  const sections = useMemo(() => buildCatalog(sets, hitDex), [sets, hitDex]);
  const eraSummaries = useMemo(() => buildEraSummaries(sections), [sections]);
  const effectVariants = useMemo(() => buildHitDexEffectVariants(sections), [sections]);
  const selectedEra = eraSummaries.some((era) => era.key === activeEra)
    ? activeEra
    : (eraSummaries[0]?.key ?? 'mega');
  const selectedEraSummary = eraSummaries.find((era) => era.key === selectedEra) ?? null;
  const visibleSections = sections.filter((section) => getSetSeriesKey(section.set) === selectedEra);
  const selectedProgress = selectedEraSummary
    ? progressPercent(selectedEraSummary.registeredCards, selectedEraSummary.totalCards)
    : 0;


  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
          <button
            type="button"
            onClick={onBackToMain}
            className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
          >
            ← 메인
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">힛카드 도감</h1>
            <p className="mt-1 truncate text-xs text-gray-500">뽑은 힛카드 모아보기</p>
          </div>
        </div>
          {backupBar ? <div className="w-full sm:ml-auto sm:w-auto">{backupBar}</div> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <section className="relative mt-12 overflow-visible rounded-[32px] bg-gradient-to-br from-red-600 via-orange-600 to-rose-950 p-2 pt-[clamp(3rem,14vw,5rem)] shadow-2xl shadow-red-950/40 ring-1 ring-red-300/30 sm:mt-16 sm:rounded-[40px] sm:p-3 sm:pt-20">
          <DexFrameFace />
          <div className="relative z-10 rounded-[24px] bg-gray-950 p-3 ring-1 ring-white/10 sm:rounded-[30px] sm:p-5">
            {eraSummaries.length > 0 && (
              <EraProgressPanel
                summaries={eraSummaries}
                activeEra={selectedEra}
                onSelectEra={setActiveEra}
              />
            )}

            <div className="rounded-[22px] border border-cyan-200/20 bg-gradient-to-br from-cyan-950/45 via-gray-950 to-slate-950 p-3 shadow-inner shadow-cyan-950/50 sm:p-5">
              <div className="mb-5 flex flex-wrap items-end justify-end gap-3 border-b border-cyan-200/10 pb-4">
                <p className="text-[11px] font-bold text-cyan-100/45">
                  {selectedEraSummary?.label ?? '도감'} {selectedEraSummary?.registeredCards ?? 0}/{selectedEraSummary?.totalCards ?? 0} · {selectedProgress}%
                </p>
              </div>

              {visibleSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-cyan-200/20 px-4 py-12 text-center">
                  <p className="text-sm font-black text-cyan-50">표시할 힛카드 도감 데이터가 없어요.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {visibleSections.map((section) => (
                    <HitDexSetSectionView
                      key={section.set.code}
                      section={section}
                      effectVariants={effectVariants}
                      onCardClick={setSelectedCard}
                      onUnknownClick={setUnknownItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
      {unknownItem && <UnknownHitModal item={unknownItem} onClose={() => setUnknownItem(null)} />}
    </div>
  );
}

function EraProgressPanel({
  summaries,
  activeEra,
  onSelectEra,
}: {
  summaries: HitDexEraSummary[];
  activeEra: SetSeriesKey;
  onSelectEra: (era: SetSeriesKey) => void;
}) {
  return (
    <section className="mb-4 rounded-[24px] border border-cyan-200/15 bg-black/25 p-3 ring-1 ring-white/5 sm:p-4">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {summaries.map((era) => {
          const progress = progressPercent(era.registeredCards, era.totalCards);
          const isActive = era.key === activeEra;
          return (
            <button
              key={era.key}
              type="button"
              onClick={() => onSelectEra(era.key)}
              className={`rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] ${
                isActive
                  ? 'bg-cyan-300 text-gray-950 ring-cyan-100 shadow-lg shadow-cyan-950/30'
                  : 'bg-gray-950/70 text-cyan-50 ring-cyan-200/15 hover:bg-cyan-300/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black sm:text-sm">{era.label}</p>
                </div>
                <span className="shrink-0 text-xs font-black tabular-nums">{progress}%</span>
              </div>
              <div className={`mt-3 h-2 overflow-hidden rounded-full ${isActive ? 'bg-gray-950/25' : 'bg-black/35'}`}>
                <div
                  className={`h-full rounded-full ${isActive ? 'bg-gray-950/80' : 'bg-cyan-300'}`}
                  style={{ width: `${Math.max(3, progress)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] font-bold opacity-70">
                {era.registeredCards}/{era.totalCards} 등록 · {era.setCount}세트
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DexFrameFace() {
  const eyeOuter = 'M31 1 C17 4 7 20 6 42 C5 64 15 79 30 81 C45 82 55 66 56 42 C57 20 47 3 31 1 Z';
  const eyePupil = 'M35 16 C27 17 21 30 21 46 C21 60 27 68 34 67 C42 64 47 49 47 34 C47 22 43 16 35 16 Z';

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-30 aspect-[5/1] w-[min(560px,84%)] -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <span className="absolute left-[17%] top-[70%] aspect-square w-[1.45%] rounded-full bg-gray-950/85" />
      <span className="absolute left-[17%] top-[86%] aspect-square w-[1.45%] rounded-full bg-gray-950/85" />
      <span className="absolute right-[17%] top-[70%] aspect-square w-[1.45%] rounded-full bg-gray-950/85" />
      <span className="absolute right-[17%] top-[86%] aspect-square w-[1.45%] rounded-full bg-gray-950/85" />

      <svg
        viewBox="0 0 60 82"
        className="absolute left-[34%] top-[52%] z-10 aspect-[30/41] w-[8.6%] -rotate-[14deg] overflow-visible drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]"
        focusable="false"
      >
        <path d={eyeOuter} fill="white" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d={eyePupil} fill="#1d4ed8" />
      </svg>
      <svg
        viewBox="0 0 60 82"
        className="absolute right-[34%] top-[52%] z-10 aspect-[30/41] w-[8.6%] rotate-[14deg] overflow-visible drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]"
        focusable="false"
      >
        <g transform="translate(60 0) scale(-1 1)">
          <path d={eyeOuter} fill="white" stroke="#cbd5e1" strokeWidth="1.2" />
          <path d={eyePupil} fill="#1d4ed8" />
        </g>
      </svg>

      <svg
        viewBox="0 0 120 52"
        className="absolute left-1/2 top-[81%] z-20 aspect-[30/13] w-[15%] -translate-x-1/2 drop-shadow-[0_2px_1px_rgba(0,0,0,0.2)]"
        focusable="false"
      >
        <path
          d="M8 10 C25 13 39 28 60 29 C81 28 95 13 112 10 C107 31 91 44 60 46 C29 44 13 31 8 10 Z"
          fill="white"
          stroke="#030712"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M26 17 L25 34" fill="none" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M43 25 L42 41" fill="none" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M60 29 L60 46" fill="none" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M77 25 L78 41" fill="none" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M94 17 L95 34" fill="none" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}function HitDexSetSectionView({
  section,
  effectVariants,
  onCardClick,
  onUnknownClick,
}: {
  section: HitDexSetSection;
  effectVariants: Map<string, HitDexEffectVariant>;
  onCardClick: (card: Card) => void;
  onUnknownClick: (item: HitDexCatalogItem) => void;
}) {
  return (
    <section className="hit-dex-set-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-cyan-50 sm:text-base">{section.set.name_ko}</h2>
        </div>
        <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black text-cyan-100 ring-1 ring-cyan-200/15">
          {section.registeredCount}/{section.cards.length}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        {section.cards.map((item) => (
          item.entry ? (
            <RegisteredHitTile
              key={item.key}
              item={item}
              effectVariant={effectVariants.get(item.key) ?? null}
              onClick={() => onCardClick(item.card)}
            />
          ) : (
            <UnknownHitTile key={item.key} item={item} onClick={() => onUnknownClick(item)} />
          )
        ))}
      </div>
    </section>
  );
}

function RegisteredHitTile({
  item,
  effectVariant,
  onClick,
}: {
  item: HitDexCatalogItem;
  effectVariant: HitDexEffectVariant | null;
  onClick: () => void;
}) {
  const { card } = item;
  const displayName = card.name_ko ?? '이름 확인 중';
  const displayRarity = card.rarity ? rarityLabel(card.rarity, card) : null;
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;

  return (
    <button
      type="button"
      onClick={onClick}
      onDragStart={(event) => event.preventDefault()}
      className="group block min-w-0 select-none text-left"
    >
      <div
        className={`card-image-frame relative aspect-[5/7] w-full overflow-hidden rounded-lg bg-gray-800 ring-1 ring-cyan-200/15 transition-transform group-hover:scale-[1.03] ${effectVariant ? `hit-dex-chase-card premium-hit-card premium-hit-card--${effectVariant}` : ''}`}
        data-watermark={showImage ? 'pokesim.kr' : undefined}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        {!showImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
            <span className="text-[9px] leading-tight text-gray-400">{displayName}</span>
          </div>
        ) : (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-800" />}
            <Image
              src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 256 })}
              alt={displayName}
              fill
              sizes="9vw"
              className="object-cover"
              unoptimized
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
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
            {effectVariant && (
              <span className={`hit-dex-chase-sparkle premium-hit-sparkle premium-hit-sparkle--${effectVariant}`} aria-hidden="true">
                <span className="premium-hit-sparkle__dust" />
              </span>
            )}
          </>
        )}

        {card.rarity && (
          <span className={`absolute bottom-0.5 right-0.5 z-10 rounded px-1 py-px text-[9px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}>
            {displayRarity}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[10px] font-bold text-cyan-50/80">{displayName}</p>
    </button>
  );
}

function UnknownHitTile({ item, onClick }: { item: HitDexCatalogItem; onClick: () => void }) {
  const rarity = item.card.rarity ? rarityLabel(item.card.rarity, item.card) : 'HIT';

  return (
    <button type="button" onClick={onClick} className="group block min-w-0 text-left">
      <div className="relative aspect-[5/7] w-full overflow-hidden rounded-lg border border-cyan-200/15 bg-gradient-to-br from-slate-900 via-cyan-950/60 to-gray-950 ring-1 ring-cyan-200/10 transition group-hover:scale-[1.03] group-hover:border-cyan-200/35 group-active:scale-95">
        <div className="absolute inset-2 rounded-md border border-dashed border-cyan-200/15" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-4xl font-black text-cyan-100/35 sm:text-5xl">?</span>
          <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-100/60 ring-1 ring-cyan-200/10">
            {rarity}
          </span>
        </div>
        <span className="absolute left-1 top-1 rounded bg-black/35 px-1.5 py-0.5 text-[9px] text-cyan-100/35">
          #{item.card.number}
        </span>
      </div>
      <p className="mt-1 truncate text-[10px] font-bold text-cyan-100/35">미등록</p>
    </button>
  );
}

function UnknownHitModal({ item, onClose }: { item: HitDexCatalogItem; onClose: () => void }) {
  const card = item.card;
  const displayName = card.name_ko ?? '이름 확인 중';
  const rarity = card.rarity ? rarityLabel(card.rarity, card) : 'HIT';

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[28px] bg-gradient-to-br from-red-600 via-orange-600 to-rose-950 p-2 shadow-2xl ring-1 ring-red-300/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-[22px] bg-gray-950 p-4 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2" aria-hidden>
            <span className="h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          </div>
          <div className="rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-950/45 via-gray-950 to-slate-950 p-5 text-center shadow-inner shadow-cyan-950/50">
            <div className="mx-auto flex aspect-[5/7] w-32 items-center justify-center rounded-xl border border-dashed border-cyan-200/20 bg-black/25">
              <span className="text-6xl font-black text-cyan-100/35">?</span>
            </div>
            <p className="mt-4 text-[10px] font-black tracking-widest text-cyan-300/80">미등록 힛카드</p>
            <h2 className="mt-1 text-xl font-black text-white">{displayName}</h2>
            <div className="mt-4 space-y-2 text-left text-xs text-cyan-100/65">
              <p><span className="text-cyan-100/35">수록 팩:</span> {item.set.name_ko}</p>
              <p><span className="text-cyan-100/35">레어도:</span> {rarity}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-50 ring-1 ring-cyan-200/20 transition hover:bg-cyan-300/15"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
