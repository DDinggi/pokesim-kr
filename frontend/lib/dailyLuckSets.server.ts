import 'server-only';

import type { SetMeta } from './types';
import m5AbyssEye from '../public/sets/m5-abyss-eye.json';
import m4NinjaSpinner from '../public/sets/m4-ninja-spinner.json';
import mNihilZero from '../public/sets/m-nihil-zero.json';
import mDreamEx from '../public/sets/m-dream-ex.json';
import mInfernoX from '../public/sets/m-inferno-x.json';
import mMegaBrave from '../public/sets/m-mega-brave.json';
import mMegaSymphonia from '../public/sets/m-mega-symphonia.json';
import sv11bBlackBolt from '../public/sets/sv11b-black-bolt.json';
import sv11aWhiteFlare from '../public/sets/sv11a-white-flare.json';
import sv10Glory from '../public/sets/sv10-glory.json';

const dailyLuckSets = [
  m5AbyssEye,
  m4NinjaSpinner,
  mNihilZero,
  mDreamEx,
  mInfernoX,
  mMegaBrave,
  mMegaSymphonia,
  sv11bBlackBolt,
  sv11aWhiteFlare,
  sv10Glory,
] as unknown as SetMeta[];

const dailyLuckSetsByCode = new Map(
  dailyLuckSets.map((set) => [set.code, set]),
);

export function getServerDailyLuckSet(setCode: string): SetMeta | null {
  return dailyLuckSetsByCode.get(setCode) ?? null;
}
