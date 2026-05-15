'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Card } from '../lib/types';
import { NEW_SIM_SET_NAMES } from '../lib/newSets';
import { fetchGlobalStats, type GlobalStats } from '../lib/statsTracker';
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

type Mode = 'box' | 'vending';

const SESSION_KEY = 'pokesim-kr-session-v1';

interface SessionData {
  boxes: number;
  packs: number;
  cost: number;
  cards: Card[];
}

function loadSession(): SessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const p = JSON.parse(stored);
    if (p && Array.isArray(p.cards) && p.cards.length > 0) {
      return {
        boxes: Number(p.boxes) || 0,
        packs: Number(p.packs) || 0,
        cost: Number(p.cost) || 0,
        cards: p.cards as Card[],
      };
    }
  } catch { /* */ }
  return null;
}

export function MainScreen({ onSelectMode }: { onSelectMode: (m: Mode) => void }) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchGlobalStats().then((s) => { if (s) setStats(s); });
    const timer = window.setTimeout(() => {
      setSession(loadSession());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80">
        <h1 className="text-2xl font-bold tracking-tight">PokéSim KR</h1>
        <p className="text-xs text-gray-500 mt-1">팬메이드 카드팩 시뮬레이터</p>
        <p className="text-sm text-gray-400 mt-3 max-w-2xl leading-relaxed">
          카드팩 개봉의 재미를 가볍게 체험할 수 있도록 만든 비공식 팬 프로젝트입니다.
        </p>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10 max-w-5xl mx-auto w-full">
        <div className="mb-5 rounded-lg bg-gradient-to-r from-sky-500/15 via-pink-500/15 to-yellow-400/15 ring-1 ring-white/10 px-4 py-3">
          <p className="text-sm sm:text-base font-bold text-white">
            <span className="text-[11px] font-black tracking-widest text-yellow-300 mr-2 align-middle">NEW</span>
            {NEW_SIM_SET_NAMES.join(' · ')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <ModeCard
            title="박스깡"
            subtitle="BOX · 30팩 일괄 개봉"
            description="한 박스를 통째로 까기. SR·SAR 보장 슬롯 포함."
            accent="from-red-600 via-rose-700 to-rose-950"
            tag="BOX"
            tagSub="× 30팩"
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
            description="자판기처럼 원하는 세트·수량만 골라 깡하기."
            accent="from-amber-500 via-orange-600 to-orange-900"
            tag="PACK"
            tagSub="× 1~10팩"
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
      </main>

      {/* 세션 히스토리 토글 */}
      {session && (
        <div className="border-t border-gray-800/80">
          <div className="flex items-center">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex-1 px-6 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="font-bold text-gray-300">지금까지 깐 카드</span>
                <span className="text-gray-500 tabular-nums">
                  {session.boxes}박스 · {session.packs}팩 · {session.cost.toLocaleString()}원
                </span>
                <HitBadges cards={session.cards} />
              </div>
              <span
                className="text-gray-500 text-xs ml-3 transition-transform duration-200"
                style={{ display: 'inline-block', transform: historyOpen ? 'rotate(180deg)' : 'none' }}
              >
                ▼
              </span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem(SESSION_KEY);
                }
                setSession(null);
                setHistoryOpen(false);
              }}
              className="px-4 py-3.5 text-xs text-gray-600 hover:text-red-400 hover:bg-white/5 transition-colors border-l border-gray-800/80 whitespace-nowrap"
            >
              초기화
            </button>
          </div>

          {historyOpen && (
            <div className="px-4 sm:px-6 pb-6 max-w-6xl mx-auto w-full">
              <CardHistoryGrid cards={session.cards} />
            </div>
          )}
        </div>
      )}

      <footer className="px-6 py-5 border-t border-gray-900 flex flex-col items-center gap-2">
        {stats && (
          <p className="text-xs text-gray-400 text-center">
            지금까지{' '}
            <span className="text-white font-bold">{stats.totalSessions.toLocaleString()}명</span>
            {'이 '}
            <span className="text-white font-bold">{stats.totalPacks.toLocaleString()}팩</span>
            {' · '}
            <span className="text-white font-bold">{stats.totalBoxes.toLocaleString()}박스</span>
            {' · '}
            <span className="text-pink-400 font-bold">{stats.totalKrw.toLocaleString()}원</span>
            {' 어치 시뮬레이션했습니다'}
          </p>
        )}
        <p className="text-[10px] text-gray-600 text-center">
          ⓘ 봉입률은 추정치 · 공식 봉입률은 공개되어 있지 않습니다
        </p>

        <div className="mt-2 pt-3 border-t border-gray-900 w-full max-w-lg flex flex-col items-center gap-1">
          <p className="text-[10px] text-gray-700 text-center">
            본 사이트는 팬이 만든 비영리 시뮬레이션 프로젝트이며, 공식 권리자와 제휴·후원·승인 관계가 없습니다.<br />
            카드 이미지와 관련 명칭은 개봉 경험 및 카드 식별을 위해 제한적으로 사용되며, 모든 권리는 각 권리자에게 있습니다.<br />
            권리자의 삭제 또는 수정 요청이 있으면 확인 후 즉시 반영하겠습니다.
          </p>
          <p className="text-[10px] text-gray-700 text-center">
            ©{new Date().getFullYear()} pokesim_kr
          </p>
          <div className="flex items-center gap-4 mt-1">
            <a
              href="https://open.kakao.com/o/sqFZE7ti"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
              </svg>
              오픈채팅 문의
            </a>
            <a
              href="mailto:whaudrl1234@gmail.com"
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
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
    <span className="flex items-center gap-1.5">
      {hits.map(({ rarity, count, sample }) => {
        return (
          <span key={rarity} className={`text-[11px] font-bold ${RARITY_TEXT_COLOR[rarity]}`}>
            {rarityLabel(rarity, sample)} {count}
          </span>
        );
      })}
    </span>
  );
}

function CardHistoryGrid({ cards }: { cards: Card[] }) {
  const sorted = sortByRarity(cards);
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-2">
      {sorted.map((card, i) => (
        <CardTile key={i} card={card} />
      ))}
    </div>
  );
}

function CardTile({ card }: { card: Card }) {
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && !!card.image_url && !errored;
  return (
    <div
      className={`card-image-frame relative aspect-[5/7] rounded-lg overflow-hidden bg-gray-800 select-none ${glow}`}
      data-watermark={showImage ? 'pokesim.kr' : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!showImage ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          <span className="text-[9px] text-gray-400 leading-tight">{card.name_ko ?? card.card_num}</span>
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 bg-gray-800 animate-pulse" />}
          <Image
            src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 256 })}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes="10vw"
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
        </>
      )}
      {card.rarity && (
        <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold px-1 py-px rounded ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'} z-10`}>
          {rarityLabel(card.rarity, card)}
        </span>
      )}
    </div>
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
  imageNode?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.99] shadow-2xl ring-1 ring-white/10 bg-gradient-to-br ${accent} p-6 sm:p-8 flex flex-col min-h-[200px] sm:min-h-[240px]`}
    >
      {/* 배경 장식 — 큰 태그 텍스트 */}
      <span
        className="absolute right-4 bottom-3 text-[64px] sm:text-[80px] font-black leading-none select-none pointer-events-none opacity-10 tracking-tighter z-0"
        aria-hidden
      >
        {tag}
      </span>

      {/* 우측 하단 썸네일 이미지 */}
      {imageNode && (
        <div className="absolute -right-2 -bottom-2 w-32 h-32 sm:w-44 sm:h-44 opacity-70 group-hover:opacity-100 group-hover:scale-110 group-hover:-translate-y-1 group-hover:-translate-x-1 transition-all duration-500 pointer-events-none z-0">
          {imageNode}
        </div>
      )}

      <div className="flex items-start justify-between mb-auto relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-1 drop-shadow-md">{subtitle}</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none drop-shadow-md">{title}</h2>
        </div>
        <span className="text-xs font-bold bg-black/30 backdrop-blur px-2.5 py-1 rounded-full text-white/80 whitespace-nowrap shadow-sm">
          {tagSub}
        </span>
      </div>

      <p className="text-sm text-white/90 font-medium leading-relaxed mt-4 relative z-10 drop-shadow-md max-w-[70%]">
        {description}
      </p>

      <div className="mt-5 flex items-center justify-end relative z-10">
        <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors bg-black/20 px-3 py-1.5 rounded-full backdrop-blur">
          시작 →
        </span>
      </div>
    </button>
  );
}
