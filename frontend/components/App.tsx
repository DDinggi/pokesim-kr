'use client';

import { useState } from 'react';
import type { SetMeta } from '../lib/types';
import { SetPicker } from './SetPicker';
import { BoxSimulator } from './BoxSimulator';

export function App({ sets }: { sets: SetMeta[] }) {
  const [selectedSet, setSelectedSet] = useState<SetMeta | null>(null);

  if (!selectedSet) {
    return <SetPicker sets={sets} onSelect={setSelectedSet} />;
  }
  return <BoxSimulator setMeta={selectedSet} onChangeSet={() => setSelectedSet(null)} />;
}
