'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Card } from '../lib/types';
import { fetchGlobalStats, type GlobalStats } from '../lib/statsTracker';

type Mode = 'box' | 'vending';

const SESSION_KEY = 'pokesim-kr-session-v1';

const RARITY_TEXT_COLOR: Record<string, string> = {
  BWR: 'text-slate-100',
  UR: 'text-yellow-300',
  MA: 'text-fuchsia-300',
  SAR: 'text-pink-300',
  SR: 'text-orange-300',
  AR: 'text-cyan-300',
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
const RARITY_DISPLAY: Record<string, string> = { UR: 'MUR' };
const RARITY_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C'];
const HIT_RARITY_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR'] as const;
const CDN_BASE = 'https://cards.image.pokemonkorea.co.kr/data/';

function rarityLabel(r: string) {
  return RARITY_DISPLAY[r] ?? r;
}

function resolveImageUrl(image_url: string): string {
  return /^https?:\/\//.test(image_url) ? image_url : `${CDN_BASE}${image_url}`;
}

function sortByRarity(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity ?? '');
    const bi = RARITY_ORDER.indexOf(b.rarity ?? '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

interface SessionData {
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
      return { packs: Number(p.packs) || 0, cost: Number(p.cost) || 0, cards: p.cards as Card[] };
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
    setSession(loadSession());
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80">
        <h1 className="text-2xl font-bold tracking-tight">PokéSim KR</h1>
        <p className="text-xs text-gray-500 mt-1">한국 포켓몬 TCG 박스깡 시뮬레이터</p>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <ModeCard
            title="박스깡"
            subtitle="BOX · 30팩 일괄 개봉"
            description="한 박스를 통째로 까기. SR·SAR 보장 슬롯 포함."
            accent="from-red-600 via-rose-700 to-rose-950"
            tag="BOX"
            tagSub="× 30팩"
            onClick={() => onSelectMode('box')}
          />
          <ModeCard
            title="자판기깡"
            subtitle="PACK · 1~10팩 골라서"
            description="자판기처럼 원하는 세트·수량만 골라 깡하기."
            accent="from-amber-500 via-orange-600 to-orange-900"
            tag="PACK"
            tagSub="× 1~10팩"
            onClick={() => onSelectMode('vending')}
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
                  {session.packs}팩 · {session.cost.toLocaleString()}원 · {session.cards.length}장
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
            {' '}이{' '}
            <span className="text-white font-bold">{stats.totalBoxes.toLocaleString()}박스</span>
            {' · '}
            <span className="text-pink-400 font-bold">₩{stats.totalKrw.toLocaleString()}</span>
            {' '}어치 시뮬레이션했습니다
          </p>
        )}
        <p className="text-[10px] text-gray-600 text-center">
          ⓘ 봉입률은 추정치 · 포켓몬코리아는 확정 봉입을 안내하지 않습니다
        </p>

        <div className="mt-2 pt-3 border-t border-gray-900 w-full max-w-lg flex flex-col items-center gap-1">
          <p className="text-[10px] text-gray-700 text-center">
            비영리 팬 시뮬레이터 · Non-commercial fan project
          </p>
          <p className="text-[10px] text-gray-700 text-center">
            © 2022–{new Date().getFullYear()} mesulive · All rights reserved
          </p>
          <p className="text-[10px] text-gray-700 text-center">
            mesulive is not associated with NEXON Korea or The Pokémon Company.
          </p>
          <a
            href="mailto:me@kurateh.com"
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors mt-0.5"
          >
            me@kurateh.com
          </a>
        </div>
      </footer>
    </div>
  );
}

function HitBadges({ cards }: { cards: Card[] }) {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    if (c.rarity) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
  }
  const hits = HIT_RARITY_ORDER.filter((r) => (counts[r] ?? 0) > 0);
  if (hits.length === 0) return null;
  return (
    <span className="flex items-center gap-1.5">
      {hits.map((r) => (
        <span key={r} className={`text-[11px] font-bold ${RARITY_TEXT_COLOR[r]}`}>
          {rarityLabel(r)} {counts[r]}
        </span>
      ))}
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
  return (
    <div className={`relative aspect-[5/7] rounded-lg overflow-hidden bg-gray-800 ${glow}`}>
      {errored || !card.image_url ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          <span className="text-[9px] text-gray-400 leading-tight">{card.name_ko ?? card.card_num}</span>
        </div>
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 bg-gray-800 animate-pulse" />}
          <Image
            src={resolveImageUrl(card.image_url)}
            alt={card.name_ko ?? card.card_num}
            fill
            sizes="10vw"
            className="object-cover"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </>
      )}
      {card.rarity && (
        <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold px-1 py-px rounded ${RARITY_BADGE[card.rarity] ?? 'bg-gray-600 text-white'} z-10`}>
          {rarityLabel(card.rarity)}
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
}: {
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  tag: string;
  tagSub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.99] shadow-2xl ring-1 ring-white/10 bg-gradient-to-br ${accent} p-6 sm:p-8 flex flex-col min-h-[200px] sm:min-h-[240px]`}
    >
      {/* 배경 장식 — 큰 태그 텍스트 */}
      <span
        className="absolute right-4 bottom-3 text-[64px] sm:text-[80px] font-black leading-none select-none pointer-events-none opacity-10 tracking-tighter"
        aria-hidden
      >
        {tag}
      </span>

      <div className="flex items-start justify-between mb-auto">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-1">{subtitle}</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">{title}</h2>
        </div>
        <span className="text-xs font-bold bg-black/30 backdrop-blur px-2.5 py-1 rounded-full text-white/80 whitespace-nowrap">
          {tagSub}
        </span>
      </div>

      <p className="text-sm text-white/70 leading-relaxed mt-4">{description}</p>

      <div className="mt-5 flex items-center justify-end">
        <span className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">
          시작 →
        </span>
      </div>
    </button>
  );
}
