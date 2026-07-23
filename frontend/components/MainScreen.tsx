'use client';

import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Card } from '../lib/types';
import { fetchGlobalStats, trackUserEvent, type GlobalStats } from '../lib/statsTracker';
import {
  getRecentOpeningDetailCards,
  hasRecentOpeningDetailCards,
  RECENT_OPENING_DETAIL_BOX_LIMIT,
  type OpeningSession,
} from '../lib/openingHistory';
import {
  getHitDexStats,
  type HitDexState,
} from '../lib/hitDex';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import {
  CARD_GLOW,
  HIT_RARITIES,
  RARITY_BADGE,
  RARITY_TEXT_COLOR,
  getHitCounts,
  premiumSparkleVariant,
  rarityLabel,
  sortByRarity,
} from '../lib/rarity';
import { CardModal } from './CardModal';

type Mode = 'box' | 'vending';

const subscribeToClientReady = () => () => {};

export function MainScreen({
  onSelectMode,
  onOpenLuck,
  onOpenHitDex,
  recordSession,
  recordHitDex,
  onResetRecords,
  accountBar,
}: {
  onSelectMode: (mode: Mode) => void;
  onOpenLuck: () => void;
  onOpenHitDex: () => void;
  recordSession: OpeningSession;
  recordHitDex: HitDexState;
  onResetRecords: () => Promise<void>;
  accountBar?: ReactNode;
}) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAllHistoryCards, setShowAllHistoryCards] = useState(false);
  const [openedCard, setOpenedCard] = useState<Card | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const localRecordsReady = useSyncExternalStore(
    subscribeToClientReady,
    () => true,
    () => false,
  );

  useEffect(() => {
    fetchGlobalStats().then((nextStats) => {
      if (nextStats) setStats(nextStats);
    });
  }, []);

  const session = localRecordsReady
    && (recordSession.cards.length > 0 || recordSession.openingEvents.length > 0)
    ? recordSession
    : null;
  const dexStats = getHitDexStats(recordHitDex);
  const recordedCardCount = session?.openingEvents.reduce(
    (sum, event) => sum + event.cardCount,
    0,
  ) ?? 0;
  const hasFullCardHistory = Boolean(session && session.cards.length >= recordedCardCount);
  const recentHistoryCards = useMemo(
    () => (session ? getRecentOpeningDetailCards(session) : []),
    [session],
  );
  const hasRecentCardHistory = Boolean(session && hasRecentOpeningDetailCards(session));
  const isCardHistoryLimited = recordedCardCount > recentHistoryCards.length;
  const toggleShowAllHistoryCards = useCallback(() => {
    setShowAllHistoryCards((showAll) => !showAll);
  }, []);
  const confirmResetRecords = useCallback(async () => {
    trackUserEvent({
      eventName: 'reset_history',
      metadata: { source: 'main_history', scope: 'all' },
    });
    setResetPending(true);
    try {
      await onResetRecords();
      setHistoryOpen(false);
      setShowAllHistoryCards(false);
      setResetConfirmOpen(false);
    } finally {
      setResetPending(false);
    }
  }, [onResetRecords]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 lg:max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight">PokéSim KR</h1>
            <p className="mt-1 text-xs text-gray-500">포켓몬 카드 시뮬레이터</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              카드 개봉의 재미를 가볍게 체험할 수 있도록 만든 비공식 팬 프로젝트입니다.
            </p>
          </div>

          <div className="w-full lg:max-w-xl">
            {accountBar}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-5 space-y-1.5 rounded-lg bg-gradient-to-r from-sky-500/15 via-pink-500/15 to-yellow-400/15 px-4 py-3 ring-1 ring-white/10">
          <p className="text-sm font-bold text-white sm:text-base">
            <span className="mr-2 align-middle text-[11px] font-black tracking-widest text-yellow-300">NEW · 7/23</span>
            썬&amp;문 페어리라이즈 · 창공의 카리스마 · 챔피언로드 추가
          </p>
          <p className="text-[11px] font-semibold text-cyan-200/80">
            &apos;내 힛카드 기록&apos;에서 뽑은 힛카드를 확인할 수 있습니다.
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed text-gray-400">
            <span>4일 주기 업데이트 예정입니다. 피드백과 문의는 언제든 환영합니다.</span>
            <a
              href="https://open.kakao.com/o/sqFZE7ti"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-cyan-200/90 transition-colors hover:text-cyan-100"
            >
              오픈채팅 문의
            </a>
            <span className="text-gray-600">·</span>
            <a
              href="mailto:pokesimkr@gmail.com"
              className="font-mono text-[10px] text-gray-500 transition-colors hover:text-gray-300"
            >
              pokesimkr@gmail.com
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <ModeCard
            title="박스깡"
            subtitle="BOX · 한 상자 한 번에 개봉"
            description="한 박스를 통째로 까기. SR·SAR 보장 슬롯을 반영합니다."
            accent="from-red-600 via-rose-700 to-rose-950"
            tag="BOX"
            tagSub="세트별 구성"
            onClick={() => onSelectMode('box')}
            imageNode={
              <Image
                src="/box.webp"
                alt="Box"
                fill
                sizes="180px"
                priority
                className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]"
              />
            }
          />
          <ModeCard
            title="자판기깡"
            subtitle="PACK · 1~10팩 골라서"
            description="자판기처럼 원하는 세트와 수량만 골라서 까기."
            accent="from-amber-500 via-orange-600 to-orange-900"
            tag="PACK"
            tagSub="x 1~10팩"
            onClick={() => onSelectMode('vending')}
            imageNode={
              <Image
                src="/pikachu.webp"
                alt="Vending Pikachu"
                fill
                sizes="180px"
                priority
                className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]"
              />
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RecordShortcut
            title="누적 운"
            detail={!localRecordsReady
              ? '기록 보기'
              : session
                ? `${session.boxes}박스 · ${session.packs}팩`
                : '개봉 기록 없음'}
            label="LUCK"
            tone="amber"
            onClick={onOpenLuck}
          />
          <RecordShortcut
            title="내 힛카드 기록"
            detail={!localRecordsReady
              ? '기록 보기'
              : dexStats.uniqueCount > 0
                ? `${dexStats.uniqueCount}종 등록`
                : '기록 없음'}
            label="HIT"
            tone="cyan"
            onClick={onOpenHitDex}
          />
        </div>
      </main>

      {session && (
        <div className="border-t border-gray-800/80">
          <div className="flex items-center">
            <button
              onClick={() => {
                setHistoryOpen((open) => {
                  if (open) setShowAllHistoryCards(false);
                  return !open;
                });
              }}
              className="flex-1 px-6 py-3.5 transition-colors hover:bg-white/5"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-gray-300">지금까지 깐 기록</span>
                <span className="text-gray-500 tabular-nums">
                  {session.boxes}박스 · {session.packs}팩 · {session.cost.toLocaleString()}원
                </span>
                {hasFullCardHistory && <HitBadges cards={session.cards} />}
              </div>
            </button>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="mr-4 rounded-full px-3 py-1.5 text-xs font-bold text-red-300 ring-1 ring-red-400/25 transition-colors hover:bg-red-500/10 hover:ring-red-300/50"
            >
              전체 기록 초기화
            </button>
          </div>

          {historyOpen && (
            <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
              <CardHistoryPanel
                cards={recentHistoryCards}
                showAll={showAllHistoryCards}
                hasRecentHistory={hasRecentCardHistory}
                isLimited={isCardHistoryLimited}
                onToggleShowAll={toggleShowAllHistoryCards}
                onCardClick={setOpenedCard}
              />
            </div>
          )}
        </div>
      )}

      {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}
      {resetConfirmOpen && (
        <ResetHistoryDialog
          pending={resetPending}
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => void confirmResetRecords()}
        />
      )}

      <footer className="flex flex-col items-center gap-2 border-t border-gray-900 px-6 py-5">
        {stats && (
          <p className="text-center text-xs text-gray-400">
            지금까지 <span className="font-bold text-white">{stats.totalSessions.toLocaleString()}명</span>이{' '}
            <span className="font-bold text-white">{stats.totalPacks.toLocaleString()}팩</span> ·{' '}
            <span className="font-bold text-white">{stats.totalBoxes.toLocaleString()}박스</span> ·{' '}
            <span className="font-bold text-pink-400">{stats.totalKrw.toLocaleString()}원</span>어치
            시뮬레이션했습니다.
          </p>
        )}
        <p className="text-center text-[10px] text-gray-600">
          봉입률은 추정치이며 공식 봉입률은 공개되어 있지 않습니다.
        </p>

        <div className="mt-2 flex w-full max-w-lg flex-col items-center gap-1 border-t border-gray-900 pt-3">
          <p className="text-center text-[10px] text-gray-700">
            본 사이트는 개인이 만든 비영리 시뮬레이터이며 공식 권리자와 제휴 관계가 없습니다.
          </p>
          <p className="text-center text-[10px] text-gray-700">©{new Date().getFullYear()} pokesim_kr</p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link
              href="/terms"
              className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
            >
              개인정보처리방침
            </Link>
            <a
              href="https://open.kakao.com/o/sqFZE7ti"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
            >
              오픈채팅 문의
            </a>
            <a
              href="mailto:pokesimkr@gmail.com"
              className="text-[10px] text-gray-500 transition-colors hover:text-gray-300"
            >
              pokesimkr@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HitBadges({ cards }: { cards: Card[] }) {
  const hits = getHitCounts(cards);
  if (hits.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {hits.map(({ rarity, count, sample }) => (
        <span key={rarity} className={`text-[11px] font-bold ${RARITY_TEXT_COLOR[rarity]}`}>
          {rarityLabel(rarity, sample)} {count}
        </span>
      ))}
    </span>
  );
}

function CardHistoryGrid({
  cards,
  onCardClick,
}: {
  cards: Card[];
  onCardClick: (card: Card) => void;
}) {
  const sorted = sortByRarity(cards);
  return (
    <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {sorted.map((card, index) => {
        const isHit = card.rarity ? HIT_RARITIES.has(card.rarity) : false;
        return (
          <CardTile
            key={`${card.card_num}-${index}`}
            card={card}
            onClick={isHit ? () => onCardClick(card) : undefined}
          />
        );
      })}
    </div>
  );
}

function getHistoryHitCards(cards: Card[]): Card[] {
  return cards.filter((card) => card.rarity && HIT_RARITIES.has(card.rarity));
}

const CardHistoryPanel = memo(function CardHistoryPanel({
  cards,
  showAll,
  hasRecentHistory,
  isLimited,
  onToggleShowAll,
  onCardClick,
}: {
  cards: Card[];
  showAll: boolean;
  hasRecentHistory: boolean;
  isLimited: boolean;
  onToggleShowAll: () => void;
  onCardClick: (card: Card) => void;
}) {
  const hitCards = getHistoryHitCards(cards);
  const visibleCards = showAll && hasRecentHistory ? cards : hitCards;

  return (
    <section className="rounded-2xl bg-gray-900/55 p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isLimited && hasRecentHistory && (
          <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-gray-500">
            최근 {RECENT_OPENING_DETAIL_BOX_LIMIT}박스 분량
          </span>
        )}
        {hasRecentHistory ? (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/15"
          >
            {showAll
              ? `힛카드만 보기 (${hitCards.length}장)`
              : `${isLimited ? '최근 카드 전체 보기' : '전체 카드 보기'} (${cards.length}장)`}
          </button>
        ) : (
          <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-gray-500">
            다른 기기에서 보관된 힛카드 {hitCards.length}장
          </span>
        )}
      </div>

      {visibleCards.length > 0 ? (
        <CardHistoryGrid cards={visibleCards} onCardClick={onCardClick} />
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">
          아직 보여줄 힛카드가 없어요.
        </p>
      )}
    </section>
  );
});

function ResetHistoryDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, pending]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-gray-900 p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reset-history-title" className="text-lg font-black text-white">
          전체 기록을 초기화할까요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          누적 운 기록만 삭제되며 힛카드 기록은 유지됩니다.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-bold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-200 ring-1 ring-red-400/30 transition hover:bg-red-500/25 disabled:opacity-50"
          >
            {pending ? '초기화 중...' : '기록 초기화'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardTile({ card, onClick }: { card: Card; onClick?: () => void }) {
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;
  const premiumSparkleRarity = showImage ? premiumSparkleVariant(card.rarity, card) : null;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`card-image-frame relative aspect-[5/7] overflow-hidden rounded-lg bg-gray-800 select-none block w-full ${premiumSparkleRarity ? `premium-hit-card premium-hit-card--${premiumSparkleRarity}` : ''} ${glow} ${onClick ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''}`}
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
          className={`absolute bottom-0.5 right-0.5 z-10 rounded px-1 py-px text-[9px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'}`}
        >
          {rarityLabel(card.rarity, card)}
        </span>
      )}
    </Wrapper>
  );
}

function RecordShortcut({
  title,
  detail,
  label,
  tone,
  onClick,
}: {
  title: string;
  detail: string;
  label: string;
  tone: 'amber' | 'cyan';
  onClick: () => void;
}) {
  const labelClass = tone === 'amber' ? 'text-amber-200' : 'text-cyan-200';
  const hoverClass = tone === 'amber'
    ? 'hover:border-amber-300/35'
    : 'hover:border-cyan-300/35';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 w-full overflow-hidden rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2.5 text-left transition hover:bg-gray-900 active:scale-[0.99] ${hoverClass}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-black text-white sm:text-sm">{title}</span>
        <span className={`shrink-0 text-[10px] font-black ${labelClass}`}>{label}</span>
      </span>
      <span className="mt-1 block truncate text-[11px] font-bold text-gray-500">{detail}</span>
    </button>
  );
}
function ModeCard({
  title,
  subtitle,
  description,
  accent,
  tag,
  tagSub,
  onClick,
  imageNode,
}: {
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  tag: string;
  tagSub: string;
  onClick: () => void;
  imageNode?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-left shadow-2xl ring-1 ring-white/10 transition-all hover:scale-[1.02] active:scale-[0.99] sm:min-h-[240px] sm:p-8 ${accent}`}
    >
      <span
        className="pointer-events-none absolute bottom-3 right-4 z-0 select-none text-[64px] font-black leading-none tracking-tighter opacity-10 sm:text-[80px]"
        aria-hidden
      >
        {tag}
      </span>

      {imageNode && (
        <div className="pointer-events-none absolute -bottom-2 -right-2 z-0 h-32 w-32 opacity-70 transition-all duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 group-hover:opacity-100 sm:h-44 sm:w-44">
          {imageNode}
        </div>
      )}

      <div className="relative z-10 mb-auto flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/60 drop-shadow-md">
            {subtitle}
          </p>
          <h2 className="text-3xl font-black leading-none tracking-tight drop-shadow-md sm:text-4xl">
            {title}
          </h2>
        </div>
        <span className="whitespace-nowrap rounded-full bg-black/30 px-2.5 py-1 text-xs font-bold text-white/80 shadow-sm backdrop-blur">
          {tagSub}
        </span>
      </div>

      <p className="relative z-10 mt-4 max-w-[70%] text-sm font-medium leading-relaxed text-white/90 drop-shadow-md">
        {description}
      </p>

      <div className="relative z-10 mt-5 flex items-center justify-end">
        <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur transition-colors group-hover:text-white">
          시작
        </span>
      </div>
    </button>
  );
}
