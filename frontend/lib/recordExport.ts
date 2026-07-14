import type { HitDexState } from './hitDex';
import type { OpeningSession } from './openingHistory';

interface RecordExportAccount {
  email: string;
  displayName: string;
}

export function buildRecordExport({
  account,
  session,
  hitDex,
}: {
  account: RecordExportAccount;
  session: OpeningSession;
  hitDex: HitDexState;
}) {
  return {
    format: 'pokesim-record-export-v1',
    exportedAt: new Date().toISOString(),
    account,
    summary: {
      boxes: session.boxes,
      packs: session.packs,
      costKrw: session.cost,
      hitDexUniqueCount: hitDex.entries.length,
      hitDexPullCount: hitDex.entries.reduce((sum, entry) => sum + entry.pullCount, 0),
    },
    openingRecords: session.openingEvents.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      setCode: event.setCode,
      unit: event.unit,
      source: event.source,
      boxCount: event.boxCount,
      packCount: event.packCount,
      cardCount: event.cardCount,
      costKrw: event.krw,
      rarityCounts: event.rarityCounts,
      hitCardNumbers: event.hitCards?.map((card) => card.card_num) ?? [],
    })),
    hitDex: hitDex.entries.map((entry) => ({
      setCode: entry.setCode,
      cardNumber: entry.cardNum,
      firstPulledAt: entry.firstPulledAt,
      lastPulledAt: entry.lastPulledAt,
      pullCount: entry.pullCount,
    })),
  };
}

export function downloadRecordExport(data: ReturnType<typeof buildRecordExport>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = data.exportedAt.slice(0, 10);
  anchor.href = url;
  anchor.download = `pokesim-records-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}