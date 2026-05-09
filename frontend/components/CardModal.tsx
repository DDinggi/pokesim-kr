'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { Card } from '../lib/types';
import { resolveCardImageUrl } from '../lib/images';
import { HOLO_RARITIES, RARITY_TIER, rarityFullLabel, rarityLabel } from '../lib/rarity';

const TYPE_LABEL: Record<string, string> = {
  풀: '풀', 불꽃: '불꽃', 물: '물', 번개: '번개',
  초: '에스퍼', 격투: '격투', 악: '악', 강철: '강철',
  드래곤: '드래곤', 무색: '노말',
};

function HoloCardImage({ card }: { card: Card }) {
  const rotatorRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  const isHolo = card.rarity ? HOLO_RARITIES.has(card.rarity) && imgLoaded && !imgError : false;
  const rarityClass = isHolo ? `holo-${card.rarity!.toLowerCase()}` : '';

  // 홀로카드 3D 틸트 + shimmer
  // window mousemove + getBoundingClientRect로 영역 안에 있는지 직접 판정 (mouseleave 이벤트 우회)
  useEffect(() => {
    if (!isHolo) return;
    const el = rotatorRef.current;
    if (!el) return;
    let inside = false;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      if (px >= 0 && px <= 1 && py >= 0 && py <= 1) {
        inside = true;
        el!.style.setProperty('--mx', String(px));
        el!.style.setProperty('--my', String(py));
        el!.style.setProperty('--active', '1');
        el!.style.transform = `perspective(800px) rotateY(${(px - 0.5) * 25}deg) rotateX(${-(py - 0.5) * 25}deg) scale(1.05)`;
        el!.style.transition = 'transform 80ms linear';
      } else if (inside) {
        inside = false;
        el!.style.setProperty('--active', '0');
        el!.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
        el!.style.transition = 'transform 600ms ease-out';
      }
    }

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isHolo]);

  if (!card.image_url) {
    return (
      <div className="aspect-[5/7] rounded-xl bg-gray-800 flex items-center justify-center">
        <span className="text-gray-500">이미지 없음</span>
      </div>
    );
  }

  return (
    <div className="holo-wrapper">
      <div
        ref={rotatorRef}
        className={`holo-card relative aspect-[5/7] rounded-xl overflow-hidden shadow-2xl ${rarityClass}`}
      >
        <Image
          src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 512 })}
          alt={card.name_ko ?? card.card_num}
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          className="object-cover select-none pointer-events-none"
          priority
          unoptimized
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            if (!useOriginal) {
              setUseOriginal(true);
              setImgLoaded(false);
            } else {
              setImgError(true);
            }
          }}
        />
        {imgError && (
          <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">🃏</span>
            <span className="text-xs text-gray-400">{card.name_ko ?? card.card_num}</span>
          </div>
        )}
        {isHolo && (
          <>
            <div className="holo-layer" />
            <div className="holo-glare" />
          </>
        )}
      </div>
    </div>
  );
}

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.code === 'Escape') onClose(); };
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
        <HoloCardImage card={card} />

        <div className="mt-5 space-y-2">
          <h2 className="text-xl font-bold leading-snug">{card.name_ko ?? card.card_num}</h2>
          {card.rarity && (
            <p className={`text-sm font-semibold ${tierColor}`}>
              {rarityLabel(card.rarity, card)} ·{' '}
              {rarityFullLabel(card.rarity, card)}
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
              <p><span className="text-gray-500">HP:</span> {card.hp}</p>
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
