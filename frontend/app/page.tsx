import { App } from '../components/App';
import type { SetMeta } from '../lib/types';

// 세트 JSON을 정적 import — 빌드 타임에 RSC payload로 인라인되어
// Cloudflare Workers 런타임에 fs 의존성이 남지 않도록 한다.
// (readFileSync 사용 시 unenv가 fs를 polyfill하지 못해 500 발생)
import sv11bBlackBolt from '../public/sets/sv11b-black-bolt.json';
import sv11aWhiteFlare from '../public/sets/sv11a-white-flare.json';
import sv10Glory from '../public/sets/sv10-glory.json';
import sv9aBlazingArena from '../public/sets/sv9a-blazing-arena.json';
import sv9BattlePartners from '../public/sets/sv9-battle-partners.json';
import sv8aTerastalFesta from '../public/sets/sv8a-terastal-festa.json';
import sv8SuperElectric from '../public/sets/sv8-super-electric.json';
import sv6Mask from '../public/sets/sv6-mask.json';
import sv2a151 from '../public/sets/sv2a-151.json';
import sv1aTriplet from '../public/sets/sv1a-triplet.json';
import m4NinjaSpinner from '../public/sets/m4-ninja-spinner.json';
import mNihilZero from '../public/sets/m-nihil-zero.json';
import mDreamEx from '../public/sets/m-dream-ex.json';
import mInfernoX from '../public/sets/m-inferno-x.json';
import mMegaBrave from '../public/sets/m-mega-brave.json';
import mMegaSymphonia from '../public/sets/m-mega-symphonia.json';

const sets: SetMeta[] = [
  // MEGA 시리즈
  m4NinjaSpinner, mNihilZero, mDreamEx, mInfernoX, mMegaBrave, mMegaSymphonia,
  // SV 시리즈
  sv11bBlackBolt, sv11aWhiteFlare, sv10Glory, sv9aBlazingArena,
  sv9BattlePartners, sv8aTerastalFesta, sv8SuperElectric, sv6Mask,
  sv2a151, sv1aTriplet,
] as SetMeta[];

export default function Home() {
  return <App sets={sets} />;
}
