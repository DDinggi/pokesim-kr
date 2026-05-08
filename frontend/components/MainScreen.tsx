'use client';

import { useState, useEffect } from 'react';
import { fetchGlobalStats, type GlobalStats } from '../lib/statsTracker';

type Mode = 'box' | 'vending';

export function MainScreen({ onSelectMode }: { onSelectMode: (m: Mode) => void }) {
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    fetchGlobalStats().then((s) => { if (s) setStats(s); });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-gray-800/80">
        <h1 className="text-2xl font-bold tracking-tight">PokéSim KR</h1>
        <p className="text-xs text-gray-500 mt-1">한국 포켓몬 TCG 박스깡 시뮬레이터</p>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-12 max-w-5xl mx-auto w-full flex items-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 w-full">
          <ModeCard
            emoji="📦"
            title="박스깡"
            subtitle="박스 단위로 통째로"
            description="30팩이 든 한 박스를 자동/수동으로 까기. SR·SAR 보장 슬롯 포함."
            gradient="from-red-700 via-rose-800 to-red-950"
            ring="ring-red-500/30 hover:ring-red-400/60"
            onClick={() => onSelectMode('box')}
          />
          <ModeCard
            emoji="🎰"
            title="자판기깡"
            subtitle="1~10팩 골라서"
            description="실제 포켓몬 자판기처럼 원하는 팩만 수량별로 골라 사기."
            gradient="from-yellow-600 via-amber-700 to-orange-900"
            ring="ring-amber-500/30 hover:ring-amber-400/60"
            onClick={() => onSelectMode('vending')}
          />
        </div>
      </main>

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
      </footer>
    </div>
  );
}

function ModeCard({
  emoji,
  title,
  subtitle,
  description,
  gradient,
  ring,
  onClick,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  ring: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl text-left transition-all hover:scale-[1.02] active:scale-[0.99] shadow-2xl ring-2 ${ring} bg-gradient-to-br ${gradient} aspect-[4/5] sm:aspect-[3/4] p-7 sm:p-8 flex flex-col`}
    >
      <div className="text-7xl sm:text-8xl mb-4 select-none drop-shadow-lg">{emoji}</div>
      <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-1">{title}</h2>
      <p className="text-sm sm:text-base text-white/80 font-bold mb-4">{subtitle}</p>
      <p className="text-sm text-white/70 leading-relaxed">{description}</p>
      <div className="mt-auto pt-6 flex items-center justify-end">
        <span className="text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">
          시작하기 →
        </span>
      </div>
    </button>
  );
}
