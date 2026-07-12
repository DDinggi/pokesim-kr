'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Card, SetMeta } from '../lib/types';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import {
  CARD_GLOW,
  RARITY_BADGE,
  premiumSparkleVariant,
  rarityLabel,
} from '../lib/rarity';
import {
  getHitDexCardKey,
  isHitDexCard,
  loadHitDex,
  type HitDexEntry,
  type HitDexState,
} from '../lib/hitDex';
import { CardModal } from './CardModal';

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

const DEX_ERAS = [
  { key: 'mega', label: 'MEGA 확장팩', shortLabel: 'MEGA' },
  { key: 'sv', label: '스칼렛&바이올렛', shortLabel: 'SV' },
  { key: 'swsh', label: '소드&실드', shortLabel: 'SWSH' },
  { key: 'sm', label: '썬&문', shortLabel: 'SM' },
  { key: 'other', label: '기타', shortLabel: 'ETC' },
] as const;

type DexEraKey = (typeof DEX_ERAS)[number]['key'];

interface HitDexEraSummary {
  key: DexEraKey;
  label: string;
  shortLabel: string;
  totalCards: number;
  registeredCards: number;
  setCount: number;
}

function getDexEraForSet(set: SetMeta): DexEraKey {
  if (set.code.startsWith('m')) return 'mega';
  if (set.code.startsWith('sv')) return 'sv';
  if (set.code.startsWith('sm')) return 'sm';
  if (set.code.startsWith('s')) return 'swsh';
  return 'other';
}

function buildEraSummaries(sections: HitDexSetSection[]): HitDexEraSummary[] {
  return DEX_ERAS.map((era) => {
    const eraSections = sections.filter((section) => getDexEraForSet(section.set) === era.key);
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

export function HitDexScreen({
  sets,
  onBackToMain,
  authReady,
  authPending,
  authError,
  accessGranted,
  localAuthPreview,
  onSignIn,
  onSignOut,
}: {
  sets: SetMeta[];
  onBackToMain: () => void;
  authReady: boolean;
  authPending: boolean;
  authError: string | null;
  accessGranted: boolean;
  localAuthPreview: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [hitDex, setHitDex] = useState<HitDexState | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [unknownItem, setUnknownItem] = useState<HitDexCatalogItem | null>(null);
  const [activeEra, setActiveEra] = useState<DexEraKey>('mega');

  useEffect(() => {
    if (!accessGranted) return;

    const timer = window.setTimeout(() => setHitDex(loadHitDex()), 0);
    return () => window.clearTimeout(timer);
  }, [accessGranted]);

  const sections = useMemo(() => (hitDex ? buildCatalog(sets, hitDex) : []), [sets, hitDex]);
  const eraSummaries = useMemo(() => buildEraSummaries(sections), [sections]);
  const selectedEra = eraSummaries.some((era) => era.key === activeEra)
    ? activeEra
    : (eraSummaries[0]?.key ?? 'mega');
  const selectedEraSummary = eraSummaries.find((era) => era.key === selectedEra) ?? null;
  const visibleSections = sections.filter((section) => getDexEraForSet(section.set) === selectedEra);
  const selectedProgress = selectedEraSummary
    ? progressPercent(selectedEraSummary.registeredCards, selectedEraSummary.totalCards)
    : 0;

  if (!authReady && !localAuthPreview) {
    return (
      <HitDexAccessScreen
        loading
        pending={authPending}
        error={authError}
        onBackToMain={onBackToMain}
        onSignIn={onSignIn}
      />
    );
  }

  if (!accessGranted) {
    return (
      <HitDexAccessScreen
        loading={false}
        pending={authPending}
        error={authError}
        onBackToMain={onBackToMain}
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-gray-900 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBackToMain}
          className="rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          ← 메인
        </button>
        {!localAuthPreview ? (
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={authPending}
            className="rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            로그아웃
          </button>
        ) : (
          <div aria-hidden />
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <section className="relative mt-12 overflow-visible rounded-[32px] bg-gradient-to-br from-red-600 via-orange-600 to-rose-950 p-2 pt-16 shadow-2xl shadow-red-950/40 ring-1 ring-red-300/30 sm:mt-16 sm:rounded-[40px] sm:p-3 sm:pt-20">
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

function HitDexAccessScreen({
  loading,
  pending,
  error,
  onBackToMain,
  onSignIn,
}: {
  loading: boolean;
  pending: boolean;
  error: string | null;
  onBackToMain: () => void;
  onSignIn: () => Promise<void>;
}) {
  const busy = loading || pending;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center border-b border-gray-900 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBackToMain}
          className="rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          ← 메인
        </button>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-xl items-center px-4 py-16 sm:px-6">
        <section className="relative w-full overflow-visible rounded-[32px] bg-gradient-to-br from-red-600 via-orange-600 to-rose-950 p-2 pt-16 shadow-2xl shadow-red-950/40 ring-1 ring-red-300/30 sm:rounded-[40px] sm:p-3 sm:pt-20">
          <DexFrameFace />
          <div className="relative z-10 rounded-[24px] bg-gray-950 p-4 ring-1 ring-white/10 sm:rounded-[30px] sm:p-6">
            <div className="rounded-[22px] border border-cyan-200/20 bg-gradient-to-br from-cyan-950/45 via-gray-950 to-slate-950 px-5 py-10 text-center shadow-inner shadow-cyan-950/50 sm:px-8 sm:py-12">
              <p className="text-xl font-black text-white">힛카드 도감</p>
              <p className="mt-2 text-sm font-bold text-cyan-100/60">
                {loading ? '로그인 확인 중' : 'Google 계정으로 계속'}
              </p>

              <button
                type="button"
                onClick={() => void onSignIn()}
                disabled={busy}
                className="mx-auto mt-7 flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-lg bg-white px-5 text-sm font-black text-gray-900 shadow-lg shadow-black/25 transition hover:bg-gray-100 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                {busy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" aria-hidden />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-sm font-black text-blue-600" aria-hidden>
                    G
                  </span>
                )}
                <span>{busy ? '확인 중...' : 'Google로 계속하기'}</span>
              </button>

              <p className="mx-auto mt-5 max-w-sm text-[11px] leading-relaxed text-gray-500">
                도감 기록은 이 브라우저에만 저장되며 Google 계정이나 서버에 업로드되지 않습니다.
              </p>

              {error && (
                <p className="mx-auto mt-4 max-w-sm text-xs font-bold leading-relaxed text-red-300" role="alert">
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function EraProgressPanel({
  summaries,
  activeEra,
  onSelectEra,
}: {
  summaries: HitDexEraSummary[];
  activeEra: DexEraKey;
  onSelectEra: (era: DexEraKey) => void;
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
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-28 w-[min(560px,84%)] -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <span className="absolute left-[17%] top-[78px] h-2 w-2 rounded-full bg-gray-950/85" />
      <span className="absolute left-[17%] top-[96px] h-2 w-2 rounded-full bg-gray-950/85" />
      <span className="absolute right-[17%] top-[78px] h-2 w-2 rounded-full bg-gray-950/85" />
      <span className="absolute right-[17%] top-[96px] h-2 w-2 rounded-full bg-gray-950/85" />

      <span className="absolute left-[34%] top-[58px] h-16 w-12 -rotate-[14deg] rounded-[55%] bg-white shadow-md ring-1 ring-slate-300/60">
        <span className="absolute left-3 top-3 h-10 w-5 rounded-[50%] bg-blue-700" />
      </span>
      <span className="absolute right-[34%] top-[58px] h-16 w-12 rotate-[14deg] rounded-[55%] bg-white shadow-md ring-1 ring-slate-300/60">
        <span className="absolute right-3 top-3 h-10 w-5 rounded-[50%] bg-blue-700" />
      </span>
    </div>
  );
}

function HitDexSetSectionView({
  section,
  onCardClick,
  onUnknownClick,
}: {
  section: HitDexSetSection;
  onCardClick: (card: Card) => void;
  onUnknownClick: (item: HitDexCatalogItem) => void;
}) {
  return (
    <section>
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
            <RegisteredHitTile key={item.key} item={item} onClick={() => onCardClick(item.card)} />
          ) : (
            <UnknownHitTile key={item.key} item={item} onClick={() => onUnknownClick(item)} />
          )
        ))}
      </div>
    </section>
  );
}

function RegisteredHitTile({ item, onClick }: { item: HitDexCatalogItem; onClick: () => void }) {
  const { card, entry } = item;
  const displayName = card.name_ko ?? '이름 확인 중';
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  const sparkle = premiumSparkleVariant(card.rarity, card);
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
        className={`card-image-frame relative aspect-[5/7] w-full overflow-hidden rounded-lg bg-gray-800 ring-1 ring-cyan-200/15 ${sparkle ? `premium-hit-card premium-hit-card--${sparkle}` : ''} ${glow} transition-transform group-hover:scale-[1.03]`}
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
            {sparkle && (
              <span className={`premium-hit-sparkle premium-hit-sparkle--${sparkle}`} aria-hidden="true">
                <span className="premium-hit-sparkle__dust" />
              </span>
            )}
          </>
        )}
        {entry && entry.pullCount > 1 && (
          <span className="absolute left-1 top-1 z-10 rounded bg-gray-950/85 px-1.5 py-0.5 text-[10px] font-black text-amber-200 ring-1 ring-amber-200/30">
            x{entry.pullCount}
          </span>
        )}
        {card.rarity && (
          <span className={`absolute bottom-0.5 right-0.5 z-10 rounded px-1 py-px text-[9px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}>
            {rarityLabel(card.rarity, card)}
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
