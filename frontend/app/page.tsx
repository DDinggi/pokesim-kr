import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from '../components/App';
import type { SetMeta } from '../lib/types';

const SET_CODES = [
  // MEGA 시리즈
  'm4-ninja-spinner', 'm-nihil-zero', 'm-dream-ex', 'm-inferno-x', 'm-mega-brave', 'm-mega-symphonia',
  // SV 시리즈
  'sv11b-black-bolt', 'sv11a-white-flare', 'sv10-glory', 'sv9a-blazing-arena',
  'sv9-battle-partners', 'sv8a-terastal-festa', 'sv8-super-electric', 'sv6-mask',
  'sv2a-151', 'sv1a-triplet',
];

export default function Home() {
  const sets: SetMeta[] = SET_CODES.map((code) =>
    JSON.parse(readFileSync(join(process.cwd(), 'public', 'sets', `${code}.json`), 'utf8')),
  );
  return <App sets={sets} />;
}
