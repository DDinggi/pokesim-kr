'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Card } from '../lib/types';
import { fetchGlobalStats, trackUserEvent, type GlobalStats } from '../lib/statsTracker';
import {
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
  HIT_RARITIES,
  RARITY_BADGE,
  RARITY_TEXT_COLOR,
  getHitCounts,
  rarityLabel,
  sortByRarity,
} from '../lib/rarity';
import { CardModal } from './CardModal';

type Mode = 'box' | 'vending';

function loadSession(): OpeningSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    const session = normalizeOpeningSession(JSON.parse(stored));
    if (session.cards.length > 0 || session.openingEvents.length > 0) return session;
  } catch {
    /* ignore corrupt localStorage */
  }
  return null;
}

export function MainScreen({
  onSelectMode,
  onOpenLuck,
}: {
  onSelectMode: (mode: Mode) => void;
  onOpenLuck: () => void;
}) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [session, setSession] = useState<OpeningSession | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAllHistoryCards, setShowAllHistoryCards] = useState(false);
  const [openedCard, setOpenedCard] = useState<Card | null>(null);

  useEffect(() => {
    fetchGlobalStats().then((nextStats) => {
      if (nextStats) setStats(nextStats);
    });
    const timer = window.setTimeout(() => setSession(loadSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">PokéSim KR</h1>
        <p className="mt-1 text-xs text-gray-500">포켓몬 카드 시뮬레이터</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
          카드 개봉의 재미를 가볍게 체험할 수 있도록 만든 비공식 팬 프로젝트입니다.
        </p>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-5 space-y-1.5 rounded-lg bg-gradient-to-r from-sky-500/15 via-pink-500/15 to-yellow-400/15 px-4 py-3 ring-1 ring-white/10">
          <p className="text-sm font-bold text-white sm:text-base">
            <span className="mr-2 align-middle text-[11px] font-black tracking-widest text-yellow-300">NEW</span>
            6/3 스타트 100덱 추가, 창공스트림
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
            subtitle="BOX · 30팩 한 번에 개봉"
            description="한 박스를 통째로 까기. SR·SAR 보장 슬롯을 반영합니다."
            accent="from-red-600 via-rose-700 to-rose-950"
            tag="BOX"
            tagSub="x 30팩"
            onClick={() => onSelectMode('box')}
            imageNode={
              <Image
                src="/box.png"
                alt="Box"
                fill
                sizes="180px"
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
                src="/pikachu.png"
                alt="Vending Pikachu"
                fill
                sizes="180px"
                className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]"
              />
            }
          />
        </div>

        <button
          onClick={() => {
            setSession(loadSession());
            onOpenLuck();
          }}
          className="mt-4 w-full rounded-2xl bg-gray-900/90 px-5 py-4 text-left ring-1 ring-white/10 transition hover:bg-gray-900 hover:ring-amber-300/40 active:scale-[0.99]"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-black text-white">내 운 확인</p>
              <p className="mt-0.5 text-xs text-gray-500">
                지금까지 깐 기록으로 누적 운 피라미드 보기
              </p>
            </div>
            <span className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-gray-950">
              LUCK
            </span>
          </div>
        </button>
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
                <span className="font-bold text-gray-300">지금까지 깐 카드</span>
                <span className="text-gray-500 tabular-nums">
                  {session.boxes}박스 · {session.packs}팩 · {session.cost.toLocaleString()}원
                </span>
                <HitBadges cards={session.cards} />
              </div>
            </button>
            <button
              onClick={() => {
                const confirmed = window.confirm('지금까지 깐 전체 기록을 초기화할까요?');
                if (!confirmed) return;
                trackUserEvent({
                  eventName: 'reset_history',
                  metadata: { source: 'main_history', scope: 'all' },
                });
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem(SESSION_STORAGE_KEY);
                }
                setSession(null);
                setHistoryOpen(false);
                setShowAllHistoryCards(false);
              }}
              className="mr-4 rounded-full px-3 py-1.5 text-xs font-bold text-red-300 ring-1 ring-red-400/25 transition-colors hover:bg-red-500/10 hover:ring-red-300/50"
            >
              전체 기록 초기화
            </button>
          </div>

          {historyOpen && (
            <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
              <CardHistoryPanel
                cards={session.cards}
                showAll={showAllHistoryCards}
                onToggleShowAll={() => setShowAllHistoryCards((showAll) => !showAll)}
                onCardClick={setOpenedCard}
              />
            </div>
          )}
        </div>
      )}

      {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} />}

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
          <div className="mt-1 flex items-center gap-4">
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

function CardHistoryPanel({
  cards,
  showAll,
  onToggleShowAll,
  onCardClick,
}: {
  cards: Card[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onCardClick: (card: Card) => void;
}) {
  const hitCards = getHistoryHitCards(cards);
  const visibleCards = showAll ? cards : hitCards;

  return (
    <section className="rounded-2xl bg-gray-900/55 p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onToggleShowAll}
          className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/15"
        >
          {showAll ? `힛카드만 보기 (${hitCards.length}장)` : `전체 카드 보기 (${cards.length}장)`}
        </button>
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
