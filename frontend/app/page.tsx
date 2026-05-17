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
import sv7aParadiseDragona from '../public/sets/sv7a-paradise-dragona.json';
import sv7StellarMiracle from '../public/sets/sv7-stellar-miracle.json';
import sv6aNightWanderer from '../public/sets/sv6a-night-wanderer.json';
import sv6Mask from '../public/sets/sv6-mask.json';
import sv5aCrimsonHaze from '../public/sets/sv5a-crimson-haze.json';
import sv5mCyberJudge from '../public/sets/sv5m-cyber-judge.json';
import sv5kWildForce from '../public/sets/sv5k-wild-force.json';
import sv4aShinyTreasureEx from '../public/sets/sv4a-shiny-treasure-ex.json';
import sv4mFutureFlash from '../public/sets/sv4m-future-flash.json';
import sv4kAncientRoar from '../public/sets/sv4k-ancient-roar.json';
import sv3aRagingSurf from '../public/sets/sv3a-raging-surf.json';
import sv3BlackFlameRuler from '../public/sets/sv3-black-flame-ruler.json';
import sv2a151 from '../public/sets/sv2a-151.json';
import sv1aTriplet from '../public/sets/sv1a-triplet.json';
import s12aVstarUniverse from '../public/sets/s12a-vstar-universe.json';
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
  sv9BattlePartners, sv8aTerastalFesta, sv8SuperElectric,
  sv7aParadiseDragona, sv7StellarMiracle,
  sv6aNightWanderer, sv6Mask,
  sv5aCrimsonHaze, sv5mCyberJudge, sv5kWildForce,
  sv4aShinyTreasureEx, sv4mFutureFlash, sv4kAncientRoar,
  sv3aRagingSurf, sv3BlackFlameRuler,
  sv2a151, sv1aTriplet, s12aVstarUniverse,
] as SetMeta[];

export default function Home() {
  return <App sets={sets} />;
}
