import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type SetIndex = {
  active_sets?: string[];
  planned_sets?: string[];
};

type SetJson = {
  code: string;
  name_ko?: string;
  type: string;
  series?: string;
  rarities?: string[];
  cards?: Array<{ rarity?: string | null }>;
  start_deck?: unknown;
};

type Args = {
  setCode?: string;
  all: boolean;
  strict: boolean;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modelSource = readFileSync(resolve(ROOT_DIR, 'frontend', 'lib', 'simulation', 'model.ts'), 'utf8');
const expansionSource = readFileSync(resolve(ROOT_DIR, 'frontend', 'lib', 'simulation', 'expansion.ts'), 'utf8');
const hiClassSource = readFileSync(resolve(ROOT_DIR, 'frontend', 'lib', 'simulation', 'hi-class.ts'), 'utf8');
const luckSource = readFileSync(resolve(ROOT_DIR, 'frontend', 'lib', 'luck.ts'), 'utf8');
const starterSource = readFileSync(resolve(ROOT_DIR, 'frontend', 'lib', 'simulation', 'starter.ts'), 'utf8');

const KNOWN_HI_CLASS_MODELS = new Set([
  'sv8a-terastal-festa',
  'sv4a-shiny-treasure-ex',
  's12a-vstar-universe',
  's8b-vmax-climax',
  'm-dream-ex',
]);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    all: false,
    strict: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--set') args.setCode = argv[++i];
    else if (arg === '--all') args.all = true;
    else if (arg === '--strict') args.strict = true;
  }

  return args;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadSet(setCode: string): SetJson {
  return readJson<SetJson>(resolve(ROOT_DIR, 'data', 'sets', `${setCode}.json`));
}

function getTargetSetCodes(args: Args): string[] {
  if (args.setCode) return [args.setCode];

  const index = readJson<SetIndex>(resolve(ROOT_DIR, 'data', 'sets-index.json'));
  if (args.all) return [...(index.active_sets ?? []), ...(index.planned_sets ?? [])];
  return index.active_sets ?? [];
}

function sourceHasSetCode(source: string, setCode: string): boolean {
  return source.includes(`'${setCode}'`) || source.includes(`"${setCode}"`);
}

function hasRarity(set: SetJson, rarity: string): boolean {
  return Boolean(set.rarities?.includes(rarity) || set.cards?.some((card) => card.rarity === rarity));
}

function hasExplicitStandardRate(setCode: string): boolean {
  return sourceHasSetCode(modelSource.slice(modelSource.indexOf('STANDARD_SV_SET_RATES')), setCode);
}

function hasMegaMonsterWeights(setCode: string): boolean {
  return sourceHasSetCode(modelSource.slice(modelSource.indexOf('EXPANSION_MONSTER_WEIGHTS')), setCode);
}

function hasMegaMainSrRange(setCode: string): boolean {
  return sourceHasSetCode(modelSource.slice(modelSource.indexOf('MEGA_MAIN_SR_NUMBER_RANGES')), setCode);
}

function validateSet(setCode: string): { warnings: string[]; errors: string[] } {
  const set = loadSet(setCode);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!set.cards || set.cards.length === 0) {
    warnings.push('카드 목록이 비어 있어 운/시뮬 검증을 건너뜁니다.');
  }

  if (set.type === 'starter') {
    if (!set.start_deck) {
      errors.push('starter 세트인데 start_deck 메타(대표카드 풀)가 없습니다.');
    }
    if (!sourceHasSetCode(modelSource, set.code)) {
      warnings.push('model.ts STARTER_SET_CODES에 세트 코드가 없습니다. isMegaExpansionSet 오탐 가능성.');
    }
    if (!luckSource.includes('isStarterSet')) {
      warnings.push('luck.ts에 starter 분기(isStarterSet)가 없습니다.');
    }
    if (!starterSource.includes('simulateStartDeck')) {
      errors.push('simulation/starter.ts에 simulateStartDeck 구현이 없습니다.');
    }
  } else if (set.type === 'hi-class') {
    if (!KNOWN_HI_CLASS_MODELS.has(set.code)) {
      warnings.push('새 hi-class 세트입니다. hi-class.ts와 luck.ts에 전용 박스/팩/운 분기가 필요합니다.');
    }
    if (!sourceHasSetCode(hiClassSource, set.code) && set.code !== 'm-dream-ex') {
      warnings.push('hi-class.ts에 세트 코드가 직접 등장하지 않습니다. 기존 공통 분기 의도인지 확인하세요.');
    }
    if (!sourceHasSetCode(luckSource, set.code) && set.code !== 'm-dream-ex') {
      warnings.push('luck.ts에 세트 코드가 직접 등장하지 않습니다. 고정 슬롯/베이스라인 차감이 맞는지 확인하세요.');
    }
  } else if (set.code.startsWith('m')) {
    if (!hasMegaMonsterWeights(set.code)) {
      warnings.push('MEGA 확장팩인데 EXPANSION_MONSTER_WEIGHTS에 세트별 SAR/MUR 가중치가 없습니다. 기본값 사용 여부를 확인하세요.');
    }
    if (!hasMegaMainSrRange(set.code)) {
      warnings.push('MEGA_MAIN_SR_NUMBER_RANGES에 세트 코드가 없습니다. 메인 SR 풀 분리가 틀어질 수 있습니다.');
    }
  } else if (set.code === 'sv11a-white-flare' || set.code === 'sv11b-black-bolt') {
    if (!sourceHasSetCode(modelSource, set.code)) {
      errors.push('SV11 특수 세트인데 isSv11SpecialSet/model.ts에 세트 코드가 없습니다.');
    }
  } else if (!hasExplicitStandardRate(set.code)) {
    warnings.push('STANDARD_SV_SET_RATES에 세트별 모델이 없습니다. 기본 SV 모델 사용 의도인지 확인하세요.');
  }

  if (hasRarity(set, 'ACE') && !sourceHasSetCode(modelSource.slice(modelSource.indexOf('ACE_SPEC_SET_CODES')), set.code)) {
    warnings.push('ACE 카드가 있는데 ACE_SPEC_SET_CODES에 세트 코드가 없습니다.');
  }

  if (hasRarity(set, 'BWR') && !(set.code === 'sv11a-white-flare' || set.code === 'sv11b-black-bolt')) {
    warnings.push('BWR 카드가 있지만 SV11 특수 운 모델이 아닙니다. luck.ts top rarity 처리 확인이 필요합니다.');
  }

  if (set.code.startsWith('m') && set.type !== 'starter' && !hasRarity(set, 'UR')) {
    warnings.push('MEGA 세트인데 UR(MUR 정규화) 카드가 없습니다. MUR 누락 가능성이 큽니다.');
  }

  if (!expansionSource.includes('buildMegaExpansionSlots') || !luckSource.includes('getBoxScoreDistribution')) {
    errors.push('시뮬/운 검증 기준 함수명을 찾지 못했습니다. 스크립트 갱신이 필요합니다.');
  }

  console.log(`\n${set.code} | ${set.name_ko ?? '(no name)'}`);
  if (warnings.length === 0 && errors.length === 0) console.log('  ok: luck/simulation coverage looks explicit enough');
  for (const warning of warnings) console.warn(`  warn: ${warning}`);
  for (const error of errors) console.error(`  error: ${error}`);

  return { warnings, errors };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const setCodes = getTargetSetCodes(args);
  let warningCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    const result = validateSet(setCode);
    warningCount += result.warnings.length;
    errorCount += result.errors.length;
  }

  console.log(`\nvalidated ${setCodes.length} set(s), warnings=${warningCount}, errors=${errorCount}`);

  if (errorCount > 0 || (args.strict && warningCount > 0)) {
    process.exitCode = 1;
  }
}

main();
