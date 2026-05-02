import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BoxSimulator } from '../components/BoxSimulator';
import type { SetMeta } from '../lib/types';

export default function Home() {
  const setMeta: SetMeta = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'sets', 'm-nihil-zero.json'), 'utf8'),
  );

  return <BoxSimulator setMeta={setMeta} />;
}
