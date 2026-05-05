import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from '../components/App';
import type { SetMeta } from '../lib/types';

const SET_CODES = ['m4-ninja-spinner', 'm-nihil-zero', 'm-dream-ex'];

export default function Home() {
  const sets: SetMeta[] = SET_CODES.map((code) =>
    JSON.parse(readFileSync(join(process.cwd(), 'public', 'sets', `${code}.json`), 'utf8')),
  );
  return <App sets={sets} />;
}
