export const HIT_DEX_LOCAL_CHANGE_EVENT = 'pokesim:hit-dex-local-change';

export function notifyHitDexLocalChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(HIT_DEX_LOCAL_CHANGE_EVENT));
}
