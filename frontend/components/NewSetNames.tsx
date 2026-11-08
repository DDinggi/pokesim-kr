import { LATEST_SET_UPDATE_SETS } from '../lib/newSets';

export function NewSetNames() {
  if (!LATEST_SET_UPDATE_SETS) return null;

  return (
    <p className="mt-2 break-keep text-base font-semibold leading-relaxed text-gray-100 sm:text-lg">
      {LATEST_SET_UPDATE_SETS}
    </p>
  );
}
