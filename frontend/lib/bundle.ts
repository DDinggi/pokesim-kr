import type { SetMeta } from './types';

export function isBundleSet(set: Pick<SetMeta, 'type'>): boolean {
  return set.type === 'bundle';
}

export function resolveBundleSet(bundle: SetMeta, catalog: SetMeta[]): SetMeta {
  if (!isBundleSet(bundle)) return bundle;
  if (!bundle.bundle_components?.length) {
    throw new Error(`${bundle.code}: bundle_components가 없습니다.`);
  }

  const byCode = new Map(catalog.map((set) => [set.code, set]));
  const resolved = bundle.bundle_components.map((component) => {
    const sourceSet = byCode.get(component.set_code);
    if (!sourceSet) {
      throw new Error(`${bundle.code}: 구성 세트 ${component.set_code}를 찾을 수 없습니다.`);
    }
    if (sourceSet.type === 'bundle' || sourceSet.type === 'starter') {
      throw new Error(`${bundle.code}: ${sourceSet.code}는 낱팩 구성으로 사용할 수 없습니다.`);
    }
    if (!Number.isInteger(component.pack_count) || component.pack_count <= 0) {
      throw new Error(`${bundle.code}: ${sourceSet.code} pack_count가 올바르지 않습니다.`);
    }
    return { set: sourceSet, pack_count: component.pack_count };
  });

  const uniqueCards = new Map<string, SetMeta['cards'][number]>();
  for (const component of resolved) {
    for (const card of component.set.cards) uniqueCards.set(card.card_num, card);
  }

  const totalPacks = resolved.reduce((sum, component) => sum + component.pack_count, 0);
  if (totalPacks !== bundle.box_size) {
    throw new Error(`${bundle.code}: 구성 팩 합계 ${totalPacks}가 box_size ${bundle.box_size}와 다릅니다.`);
  }

  return {
    ...bundle,
    cards: Array.from(uniqueCards.values()),
    resolved_bundle_components: resolved,
  };
}

export function getBundleCardCount(bundle: SetMeta): number {
  return (bundle.resolved_bundle_components ?? []).reduce(
    (total, component) => total + component.pack_count * component.set.pack_size,
    0,
  );
}
