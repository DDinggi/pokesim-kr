'use client';

import { useState } from 'react';
import type { SetMeta } from '../lib/types';
import { MainScreen } from './MainScreen';
import { SetPicker } from './SetPicker';
import { BoxSimulator } from './BoxSimulator';
import { VendingMachine } from './VendingMachine';

type Mode = 'main' | 'box' | 'vending';

export function App({ sets }: { sets: SetMeta[] }) {
  const [mode, setMode] = useState<Mode>('main');
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);

  // 배틀파트너즈 강제 숨김 처리 (박스깡, 자판기깡 공통 적용)
  const displaySets = sets.filter((s) => s.code !== 'sv9-battle-partners');

  const goMain = () => {
    setMode('main');
    setSelectedSet(null);
  };

  if (mode === 'main') {
    return <MainScreen onSelectMode={(m) => setMode(m)} />;
  }

  if (mode === 'vending') {
    return <VendingMachine sets={displaySets} onBackToMain={goMain} />;
  }

  // box mode
  if (!selectedSet) {
    return <SetPicker sets={displaySets} onSelect={setSelectedSet} onBackToMain={goMain} />;
  }
  return <BoxSimulator setMeta={selectedSet} onChangeSet={() => setSelectedSet(null)} />;
}
