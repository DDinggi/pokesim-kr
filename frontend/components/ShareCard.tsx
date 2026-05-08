'use client';

import { useRef } from 'react';
import { toPng } from 'html-to-image';
import type { Card, SetMeta } from '../lib/types';

const RARITY_ORDER = ['BWR', 'UR', 'MA', 'SAR', 'SR', 'AR', 'RR', 'R'];
const RARITY_LABEL: Record<string, string> = { UR: 'MUR' };

interface ShareCardProps {
  meta: SetMeta;
  boxes: number;
  singlePacks: number;
  totalKrw: number;
  sessionCards: Card[];
  luck: { percentile: number; isLucky: boolean } | null;
}

const BIG_HIT = new Set(['BWR', 'UR', 'MA', 'SAR']);

export function ShareCard({ meta, boxes, singlePacks, totalKrw, sessionCards, luck }: ShareCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const counts: Record<string, number> = {};
  for (const c of sessionCards) {
    if (c.rarity) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
  }
  const bigHitCount = Object.entries(counts)
    .filter(([r]) => BIG_HIT.has(r))
    .reduce((s, [, n]) => s + n, 0);

  const luckText = luck
    ? luck.isLucky
      ? `상위 ${luck.percentile}%`
      : `하위 ${luck.percentile}%`
    : null;
  const luckColor = luck
    ? luck.isLucky
      ? '#f9a8d4'   // pink-300
      : '#94a3b8'   // slate-400
    : '#6b7280';

  async function download() {
    if (!ref.current) return;
    try {
      const png = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.href = png;
      a.download = `pokesim-${meta.code}-${Date.now()}.png`;
      a.click();
    } catch {
      // silent fail
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 캡처 대상 카드 — hidden 처리 안 하고 overflow로 가리면 캡처 안 됨, 실제로 그냥 렌더 */}
      <div
        ref={ref}
        style={{
          width: 400,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          borderRadius: 16,
          padding: '28px 28px 20px',
          fontFamily: 'Arial, sans-serif',
          color: '#fff',
          boxSizing: 'border-box',
        }}
      >
        {/* 브랜딩 */}
        <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: 2, marginBottom: 4 }}>
          POKÉSIM KR
        </p>
        {/* 세트명 */}
        <p style={{ fontSize: 18, fontWeight: 900, marginBottom: 2, lineHeight: 1.3 }}>
          {meta.name_ko}
        </p>
        {/* 부제 */}
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
          {boxes > 0 && `박스 ${boxes}개`}
          {boxes > 0 && singlePacks > 0 && ' · '}
          {singlePacks > 0 && `단품 ${singlePacks}팩`}
          {' · '}
          <span style={{ color: '#f9a8d4' }}>₩{totalKrw.toLocaleString()}</span>
        </p>

        {/* 레어 배지 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {RARITY_ORDER.map((r) => {
            const n = counts[r];
            if (!n) return null;
            const bg = r === 'BWR' ? '#e5e7eb' : r === 'UR' ? '#fde047' : r === 'MA' ? '#e879f9' : r === 'SAR' ? '#f472b6' : r === 'SR' ? '#fb923c' : r === 'AR' ? '#22d3ee' : r === 'RR' ? '#fbbf24' : '#a78bfa';
            return (
              <span key={r} style={{ background: bg, color: '#111', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
                {RARITY_LABEL[r] ?? r} ×{n}
              </span>
            );
          })}
          {Object.keys(counts).length === 0 && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>레어 없음</span>
          )}
        </div>

        {/* 운 지수 + 빅히트 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
          <div>
            <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>SAR+UR 합계</p>
            <p style={{ fontSize: 24, fontWeight: 900 }}>{bigHitCount}장</p>
          </div>
          {luckText && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>운 지수</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: luckColor }}>{luckText}</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={download}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl font-bold text-sm transition shadow-lg shadow-indigo-900/40"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        결과 이미지 저장
      </button>
    </div>
  );
}
