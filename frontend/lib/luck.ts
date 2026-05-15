import type { Card, SetMeta } from './types';
import { isMegaContext } from './rarity';
import {
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
  HI_CLASS_GOD_PACK_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  SV11_OPTIONAL_TOP_WEIGHTS,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
  getStandardSvSetRate,
  isMegaExpansionSet,
  isSv11SpecialSet,
} from './simulation/model';

const DEFAULT_BOX_SIZE = 30;

export interface LuckOpening {
  setCode: string;
  boxes: number;
  packs: number;
  boxSize: number;
  topPerBox: number;
  sarPerBox: number;
}

export interface LuckEventSummary {
  topCount: number;
  sarCount: number;
  topExpected: number;
  sarExpected: number;
}

function weightChance(weights: Record<string, number>, key: string): number {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return total > 0 ? (weights[key] ?? 0) / total : 0;
}

const DEFAULT_STANDARD_SV_HIGH_WEIGHTS = {
  SR_POKEMON: 48.125,
  SR_TRAINER: 21.875,
  SAR: 20,
  UR: 10,
};

export function getLuckRatesForSet(
  set: Pick<SetMeta, 'code' | 'type' | 'box_size'>,
): Pick<LuckOpening, 'boxSize' | 'topPerBox' | 'sarPerBox'> {
  const boxSize = Math.max(1, set.box_size || DEFAULT_BOX_SIZE);

  if (set.type === 'hi-class') {
    if (set.code === 'sv8a-terastal-festa') {
      return {
        boxSize,
        topPerBox: 0,
        sarPerBox: 1 + weightChance(TERASTAL_EXTRA_SLOT_WEIGHTS, 'SAR'),
      };
    }

    if (set.code === 'sv4a-shiny-treasure-ex') {
      return {
        boxSize,
        topPerBox:
          weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'UR')
          + weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'SSR'),
        sarPerBox: 1 + weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'SAR'),
      };
    }

    return {
      boxSize,
      topPerBox: isMegaExpansionSet(set.code) ? weightChance(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, 'UR') : 0,
      sarPerBox: weightChance(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, 'SAR') + HI_CLASS_GOD_PACK_RATE * 4,
    };
  }

  if (isMegaExpansionSet(set.code)) {
    const pokemonHighWeights = EXPANSION_MONSTER_WEIGHTS[set.code] ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;

    return {
      boxSize,
      topPerBox: weightChance(pokemonHighWeights, 'UR'),
      sarPerBox: weightChance(pokemonHighWeights, 'SAR'),
    };
  }

  if (isSv11SpecialSet(set.code)) {
    return {
      boxSize,
      topPerBox: weightChance(SV11_OPTIONAL_TOP_WEIGHTS, 'BWR'),
      sarPerBox: weightChance(SV11_OPTIONAL_TOP_WEIGHTS, 'SAR'),
    };
  }

  const standardRate = getStandardSvSetRate(set.code);
  if (standardRate) {
    return {
      boxSize,
      topPerBox: 0,
      sarPerBox: weightChance(standardRate.mandatoryHighWeights, 'SAR'),
    };
  }

  return {
    boxSize,
    topPerBox: 0,
    sarPerBox: weightChance(DEFAULT_STANDARD_SV_HIGH_WEIGHTS, 'SAR'),
  };
}

export function createLuckOpening(
  set: Pick<SetMeta, 'code' | 'type' | 'box_size'>,
  counts: { boxes?: number; packs?: number },
): LuckOpening {
  const rates = getLuckRatesForSet(set);

  return {
    setCode: set.code,
    boxes: counts.boxes ?? 0,
    packs: counts.packs ?? 0,
    ...rates,
  };
}

export function summarizeLuckEvent(cards: Card[], opening: LuckOpening): LuckEventSummary {
  const packEquivalent = opening.boxes * opening.boxSize + opening.packs;

  return {
    topCount: cards.filter((card) => card.rarity === 'BWR' || (card.rarity === 'UR' && isMegaContext(card))).length,
    sarCount: cards.filter((card) => card.rarity === 'SAR').length,
    topExpected: (opening.topPerBox / opening.boxSize) * packEquivalent,
    sarExpected: (opening.sarPerBox / opening.boxSize) * packEquivalent,
  };
}
