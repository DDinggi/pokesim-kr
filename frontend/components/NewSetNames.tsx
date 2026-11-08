import { LATEST_SET_UPDATE_SETS } from '../lib/newSets';

const NAME_COLORS = [
  'bg-violet-400/10 text-violet-200 ring-violet-300/25',
  'bg-sky-400/10 text-sky-200 ring-sky-300/25',
  'bg-rose-400/10 text-rose-200 ring-rose-300/25',
  'bg-pink-400/10 text-pink-200 ring-pink-300/25',
];

export function NewSetNames() {
  if (!LATEST_SET_UPDATE_SETS) return null;

  return (
    <ul aria-label="새로 추가된 세트" className="mt-2 flex flex-wrap gap-2 text-sm font-extrabold leading-relaxed sm:text-base">
      {LATEST_SET_UPDATE_SETS.split(' · ').map((name, index) => (
        <li key={name} className={`whitespace-nowrap rounded-md px-2.5 py-1 ring-1 ring-inset ${NAME_COLORS[index % NAME_COLORS.length]}`}>
          {name}
        </li>
      ))}
    </ul>
  );
}
