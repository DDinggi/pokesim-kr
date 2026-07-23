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
import sv2pSnowHazard from '../public/sets/sv2p-snow-hazard.json';
import sv2dClayBurst from '../public/sets/sv2d-clay-burst.json';
import sv1aTriplet from '../public/sets/sv1a-triplet.json';
import sv1vVioletEx from '../public/sets/sv1v-violet-ex.json';
import sv1sScarletEx from '../public/sets/sv1s-scarlet-ex.json';
import s12aVstarUniverse from '../public/sets/s12a-vstar-universe.json';
import s12ParadigmTrigger from '../public/sets/s12-paradigm-trigger.json';
import s11aIncandescentArcana from '../public/sets/s11a-incandescent-arcana.json';
import s11LostAbyss from '../public/sets/s11-lost-abyss.json';
import s10bPokemonGo from '../public/sets/s10b-pokemon-go.json';
import s10aDarkPhantasma from '../public/sets/s10a-dark-phantasma.json';
import s10dTimeGazer from '../public/sets/s10d-time-gazer.json';
import s10pSpaceJuggler from '../public/sets/s10p-space-juggler.json';
import s9aBattleRegion from '../public/sets/s9a-battle-region.json';
import s9StarBirth from '../public/sets/s9-star-birth.json';
import s8bVmaxClimax from '../public/sets/s8b-vmax-climax.json';
import s8FusionArts from '../public/sets/s8-fusion-arts.json';
import s7rSkyStream from '../public/sets/s7r-sky-stream.json';
import s6aEeveeHeroes from '../public/sets/s6a-eevee-heroes.json';
import s6hSilverLance from '../public/sets/s6h-silver-lance.json';
import s6kJetBlackSpirit from '../public/sets/s6k-jet-black-spirit.json';
import s5aMatchlessFighters from '../public/sets/s5a-matchless-fighters.json';
import s5iSingleStrikeMaster from '../public/sets/s5i-single-strike-master.json';
import s5rRapidStrikeMaster from '../public/sets/s5r-rapid-strike-master.json';
import s4aShinyStarV from '../public/sets/s4a-shiny-star-v.json';
import s4AmazingVoltTackle from '../public/sets/s4-amazing-volt-tackle.json';
import s3aLegendaryHeartbeat from '../public/sets/s3a-legendary-heartbeat.json';
import s3InfinityZone from '../public/sets/s3-infinity-zone.json';
import s2aExplosiveWalker from '../public/sets/s2a-explosive-walker.json';
import s2RebellionCrash from '../public/sets/s2-rebellion-crash.json';
import s1aVmaxRising from '../public/sets/s1a-vmax-rising.json';
import s1wSword from '../public/sets/s1w-sword.json';
import s1hShield from '../public/sets/s1h-shield.json';
import sm12aTagTeamGxTagAllStars from '../public/sets/sm12a-tag-team-gx-tag-all-stars.json';
import sm12AlterGenesis from '../public/sets/sm12-alter-genesis.json';
import sm11bDreamLeague from '../public/sets/sm11b-dream-league.json';
import sm11aRemixBout from '../public/sets/sm11a-remix-bout.json';
import sm11MiracleTwin from '../public/sets/sm11-miracle-twin.json';
import sm8BurstImpact from '../public/sets/sm8-burst-impact.json';
import sm7bFairyRise from '../public/sets/sm7b-fairy-rise.json';
import sm7aPlasmaSpark from '../public/sets/sm7a-plasma-spark.json';
import sm7SkyCharisma from '../public/sets/sm7-sky-charisma.json';
import sm6bChampionRoad from '../public/sets/sm6b-champion-road.json';
import sm4plusGxBattleBoostRemaster from '../public/sets/sm4plus-gx-battle-boost-remaster.json';
import sm9TagBolt from '../public/sets/sm9-tag-bolt.json';
import sm8aDarkOrder from '../public/sets/sm8a-dark-order.json';
import sm9bFullMetalWall from '../public/sets/sm9b-full-metal-wall.json';
import sm9aNightUnison from '../public/sets/sm9a-night-unison.json';
import sm10bSkyLegend from '../public/sets/sm10b-sky-legend.json';
import sm10aGgEnd from '../public/sets/sm10a-gg-end.json';
import sm10DoubleBlaze from '../public/sets/sm10-double-blaze.json';
import sm8bGxUltraShiny from '../public/sets/sm8b-gx-ultra-shiny.json';
import mStartDeck100 from '../public/sets/m-start-deck-100.json';
import m4NinjaSpinner from '../public/sets/m4-ninja-spinner.json';
import m5AbyssEye from '../public/sets/m5-abyss-eye.json';
import mNihilZero from '../public/sets/m-nihil-zero.json';
import mDreamEx from '../public/sets/m-dream-ex.json';
import mInfernoX from '../public/sets/m-inferno-x.json';
import mMegaBrave from '../public/sets/m-mega-brave.json';
import mMegaSymphonia from '../public/sets/m-mega-symphonia.json';

const sets: SetMeta[] = [
  // MEGA 시리즈
  m4NinjaSpinner, m5AbyssEye, mNihilZero, mDreamEx, mInfernoX, mMegaBrave, mMegaSymphonia,
  mStartDeck100,
  // SV 시리즈
  sv11bBlackBolt, sv11aWhiteFlare, sv10Glory, sv9aBlazingArena,
  sv9BattlePartners, sv8aTerastalFesta, sv8SuperElectric,
  sv7aParadiseDragona, sv7StellarMiracle,
  sv6aNightWanderer, sv6Mask,
  sv5aCrimsonHaze, sv5mCyberJudge, sv5kWildForce,
  sv4aShinyTreasureEx, sv4mFutureFlash, sv4kAncientRoar,
  sv3aRagingSurf, sv3BlackFlameRuler,
  sv2a151, sv2pSnowHazard, sv2dClayBurst,
  sv1aTriplet, sv1vVioletEx, sv1sScarletEx,
  s12aVstarUniverse, s12ParadigmTrigger,
  s11aIncandescentArcana, s11LostAbyss, s10bPokemonGo,
  s10aDarkPhantasma, s10dTimeGazer, s10pSpaceJuggler,
  s9aBattleRegion, s9StarBirth, s8bVmaxClimax,
  s8FusionArts, s7rSkyStream, s6aEeveeHeroes, s6hSilverLance,
  s6kJetBlackSpirit, s5aMatchlessFighters,
  s5iSingleStrikeMaster, s5rRapidStrikeMaster,
  s4aShinyStarV, s4AmazingVoltTackle,
  s3aLegendaryHeartbeat, s3InfinityZone,
  s2aExplosiveWalker, s2RebellionCrash,
  s1aVmaxRising, s1wSword, s1hShield,
  sm12aTagTeamGxTagAllStars, sm12AlterGenesis, sm11bDreamLeague,
  sm11aRemixBout, sm11MiracleTwin,
  sm8BurstImpact, sm7bFairyRise, sm7aPlasmaSpark, sm7SkyCharisma, sm6bChampionRoad,
  sm4plusGxBattleBoostRemaster,
  sm9TagBolt, sm8aDarkOrder, sm9bFullMetalWall, sm9aNightUnison, sm10bSkyLegend, sm10aGgEnd,
  sm10DoubleBlaze, sm8bGxUltraShiny,
] as SetMeta[];

export default function Home() {
  return <App sets={sets} />;
}
