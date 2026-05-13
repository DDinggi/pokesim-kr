'use client';

import { useEffect, useState } from 'react';
import type { SetMeta } from '../lib/types';
import { trackUserEvent } from '../lib/statsTracker';
import { MainScreen } from './MainScreen';
import { SetPicker } from './SetPicker';
import { BoxSimulator } from './BoxSimulator';
import { VendingMachine } from './VendingMachine';

type Mode = 'main' | 'box' | 'vending';

export function App({ sets }: { sets: SetMeta[] }) {
  const [mode, setMode] = useState<Mode>('main');
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);

  useEffect(() => {
    trackUserEvent({
      eventName: 'page_view',
      metadata: { path: window.location.pathname },
    });
  }, []);

  const goMain = () => {
    setMode('main');
    setSelectedSet(null);
  };

  if (mode === 'main') {
    return (
      <MainScreen
        onSelectMode={(m) => {
          trackUserEvent({ eventName: 'select_mode', mode: m });
          setMode(m);
        }}
      />
    );
  }

  if (mode === 'vending') {
    return <VendingMachine sets={sets} onBackToMain={goMain} />;
  }

  // box mode
  if (!selectedSet) {
    return (
      <SetPicker
        sets={sets}
        onSelect={(set) => {
          trackUserEvent({ eventName: 'select_set', mode: 'box', setCode: set.code });
          setSelectedSet(set);
        }}
        onBackToMain={goMain}
      />
    );
  }
  return <BoxSimulator key={selectedSet.code} setMeta={selectedSet} onChangeSet={() => setSelectedSet(null)} />;
}
