'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import type { Card } from '../lib/types';

const CDN_BASE = 'https://cards.image.pokemonkorea.co.kr/data/';

function resolveImageUrl(image_url: string): string {
  return /^https?:\/\//.test(image_url) ? image_url : `${CDN_BASE}${image_url}`;
}

const RARITY_DISPLAY: Record<string, string> = {
  UR: 'MUR',
};

const RARITY_LABEL: Record<string, string> = {
  C: '커먼',
  U: '언커먼',
  R: '레어',
  RR: '더블 레어',
  AR: '아트 레어',
  SR: '슈퍼 레어',
  SAR: '스페셜 아트 레어',
  MA: '마스터 아트',
  UR: '메가 울트라 레어',
};

const RARITY_TIER: Record<string, string> = {
  C: 'text-gray-400',
  U: 'text-blue-400',
  R: 'text-purple-400',
  RR: 'text-amber-300',
  AR: 'text-cyan-300',
  SR: 'text-orange-300',
  SAR: 'text-pink-300',
  MA: 'text-fuchsia-300',
  UR: 'text-yellow-300',
};

// 정식 한국 포켓몬 타입명 — pokemoncard.co.kr 약어 → 풀네임
const TYPE_LABEL: Record<string, string> = {
  풀: '풀',
  불꽃: '불꽃',
  물: '물',
  번개: '번개',
  초: '초능력',
  격투: '격투',
  악: '악',
  강철: '강철',
  드래곤: '드래곤',
  무색: '노말',
};

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const tierColor = card.rarity ? (RARITY_TIER[card.rarity] ?? 'text-gray-300') : 'text-gray-300';

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl p-6 max-w-md w-full ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {card.image_url ? (
            <div className="relative aspect-[5/7] rounded-xl overflow-hidden shadow-lg">
              <Image
                src={resolveImageUrl(card.image_url)}
                alt={card.name_ko ?? card.card_num}
                fill
                sizes="(max-width: 640px) 90vw, 400px"
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div className="aspect-[5/7] rounded-xl bg-gray-800 flex items-center justify-center">
              <span className="text-gray-500">이미지 없음</span>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <h2 className="text-xl font-bold leading-snug">{card.name_ko ?? card.card_num}</h2>
          {card.rarity && (
            <p className={`text-sm font-semibold ${tierColor}`}>
              {RARITY_DISPLAY[card.rarity] ?? card.rarity} ·{' '}
              {RARITY_LABEL[card.rarity] ?? card.rarity}
            </p>
          )}
          <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-white/5">
            {card.card_type && (
              <p>
                <span className="text-gray-500">유형:</span> {card.card_type}
                {card.subtype ? ` / ${card.subtype}` : ''}
              </p>
            )}
            {card.type && (
              <p>
                <span className="text-gray-500">타입:</span> {TYPE_LABEL[card.type] ?? card.type}
              </p>
            )}
            {card.hp != null && (
              <p>
                <span className="text-gray-500">HP:</span> {card.hp}
              </p>
            )}
            <p className="font-mono text-[11px] text-gray-600 pt-1">{card.card_num}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 transition font-bold text-sm"
        >
          닫기 (ESC)
        </button>
      </div>
    </div>
  );
}
