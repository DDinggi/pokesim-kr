import type { SetMeta } from '../lib/types';
import { getBundleComponentDisplayName, isBundleSet } from '../lib/bundle';

export function BundlePackList({
  set,
  className = '',
}: {
  set: SetMeta;
  className?: string;
}) {
  if (!isBundleSet(set) || !set.resolved_bundle_components?.length) return null;

  return (
    <ul aria-label="동봉 팩 구성" className={`flex flex-wrap ${className}`}>
      {set.resolved_bundle_components.map((component) => (
        <li key={component.set.code} className="whitespace-nowrap">
          <span>{getBundleComponentDisplayName(component.set)}</span>{' '}
          <strong className="font-black text-current">{component.pack_count}팩</strong>
        </li>
      ))}
    </ul>
  );
}
