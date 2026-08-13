import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dailyFortuneCopyDefault from '../frontend/lib/dailyFortuneCopy.ts';
import dailyLuckDefault from '../frontend/lib/dailyLuck.ts';
import dailyLuckPriceData from '../frontend/lib/dailyLuckPrices.generated.json';
import dailyLuckPricesDefault from '../frontend/lib/dailyLuckPrices.ts';
import luckDefault from '../frontend/lib/luck.ts';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { DailyLuckMine, DailyLuckResult } from '../frontend/lib/dailyLuck.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';

const {
  DAILY_FORTUNE_COPY,
  DAILY_FORTUNE_GRADES,
  DAILY_FORTUNE_VARIATION_COUNT,
} = dailyFortuneCopyDefault as unknown as typeof import('../frontend/lib/dailyFortuneCopy.ts');
const {
  DAILY_LUCK_BOX_COUNT,
  DAILY_LUCK_ROTATION_EPOCH,
  DAILY_LUCK_SET_CODES,
  DAILY_LUCK_WORST_VALUE_KRW,
  getDailyLuckFortune,
  getDailyLuckSetCode,
  getKstDate,
  getNextKstResetAt,
  isDailyLuckResultCard,
} = dailyLuckDefault as unknown as typeof import('../frontend/lib/dailyLuck.ts');
const { createLuckOpening, summarizeWeightedLuckEvent } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const {
  DAILY_LUCK_UNLISTED_CARD_CAP_KRW,
  getDailyLuckReferenceValueKrw,
} = dailyLuckPricesDefault as unknown as typeof import('../frontend/lib/dailyLuckPrices.ts');

const SAMPLES_PER_SET = 24;

function addUtcDays(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function readSet(setCode: string): SetMeta {
  const path = fileURLToPath(new URL(`../data/sets/${setCode}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as SetMeta;
}

function validateRotation() {
  assert.equal(getDailyLuckSetCode(DAILY_LUCK_ROTATION_EPOCH), DAILY_LUCK_SET_CODES[0]);
  for (let offset = 0; offset < DAILY_LUCK_SET_CODES.length * 3; offset += 1) {
    assert.equal(
      getDailyLuckSetCode(addUtcDays(DAILY_LUCK_ROTATION_EPOCH, offset)),
      DAILY_LUCK_SET_CODES[offset % DAILY_LUCK_SET_CODES.length],
    );
  }
  assert.equal(getKstDate(new Date('2026-08-13T14:59:59.999Z')), '2026-08-13');
  assert.equal(getKstDate(new Date('2026-08-13T15:00:00.000Z')), '2026-08-14');
  assert.equal(getNextKstResetAt('2026-08-13'), '2026-08-13T15:00:00.000Z');
  assert.deepEqual(
    Object.keys(dailyLuckPriceData.sets),
    [...DAILY_LUCK_SET_CODES],
    '로테이션은 GGValue 기준가가 있는 세트만 사용해야 함',
  );
  assert.deepEqual(Object.keys(DAILY_LUCK_WORST_VALUE_KRW), [...DAILY_LUCK_SET_CODES]);
}

function validateFortunes() {
  assert.equal(DAILY_FORTUNE_VARIATION_COUNT, 7_680);
  for (const grade of DAILY_FORTUNE_GRADES) {
    const pool = DAILY_FORTUNE_COPY[grade];
    assert.equal(pool.titles.length, 8);
    assert.equal(pool.messages.length, 12);
    assert.equal(pool.luckyNotes.length, 10);
    assert.equal(new Set(pool.titles).size, pool.titles.length);
    assert.equal(new Set(pool.messages).size, pool.messages.length);
    assert.equal(new Set(pool.luckyNotes).size, pool.luckyNotes.length);
  }
  assert.equal(DAILY_FORTUNE_COPY.legendary.label, '대대길');
  assert.equal(DAILY_FORTUNE_COPY.future.label, '말길');
  assert.equal(DAILY_FORTUNE_COPY.worst.label, '대흉');

  const result: DailyLuckResult = {
    boxCount: DAILY_LUCK_BOX_COUNT,
    boxPriceKrw: 45_000,
    packCount: 30,
    packCardNums: [['TEST-001']],
    hitCardNums: ['TEST-001'],
    rarityCounts: { SAR: 1 },
    hitCount: 1,
    topCardNum: 'TEST-001',
    topRarity: 'SAR',
    observedValueKrw: 10_000,
    scorePercentile: 0.82,
    totalCards: 150,
  };
  const mine: DailyLuckMine = {
    rank: 3,
    publicName: '테스트',
    nicknamePublic: true,
    openedAt: '2026-08-13T00:00:00.000Z',
    result,
  };
  const fortune = getDailyLuckFortune(mine, '2026-08-13');
  assert.equal(fortune.grade, 'bad');
  assert.equal(fortune.gradeHanja, '凶');
  assert.deepEqual(getDailyLuckFortune(mine, '2026-08-13'), fortune);
  assert.deepEqual(getDailyLuckFortune({ ...mine, rank: 999 }, '2026-08-13'), fortune);

  const gradeForValue = (observedValueKrw: number) => getDailyLuckFortune({
    ...mine,
    result: { ...result, observedValueKrw },
  }, '2026-08-13').grade;
  assert.equal(gradeForValue(7_999), 'worst');
  assert.equal(gradeForValue(8_000), 'bad');
  assert.equal(gradeForValue(11_250), 'future');
  assert.equal(gradeForValue(15_750), 'small');
  assert.equal(gradeForValue(22_500), 'good');
  assert.equal(gradeForValue(33_750), 'blessing');
  assert.equal(gradeForValue(45_000), 'great');
  assert.equal(gradeForValue(135_000), 'legendary');

  const combinations = new Set<string>();
  for (let index = 0; index < 300; index += 1) {
    const varied = getDailyLuckFortune({
      ...mine,
      openedAt: `2026-08-13T${String(index % 24).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`,
      result: {
        ...result,
        topCardNum: `TEST-${index}`,
        observedValueKrw: 10_000 + index,
      },
    }, addUtcDays('2026-08-13', index));
    combinations.add(`${varied.title}|${varied.message}|${varied.luckyNote}`);
  }
  assert.ok(combinations.size >= 180, `운세 조합이 충분히 다양하지 않음: ${combinations.size}`);
}

function validateReferencePriceFallbacks() {
  const createCard = (overrides: Partial<Card>): Card => ({
    card_num: 'TEST-001',
    number: 99_999,
    name_ko: '테스트 카드',
    rarity: 'AR',
    card_type: 'pokemon',
    subtype: null,
    hp: null,
    type: null,
    image_url: '/test.png',
    ...overrides,
  });
  const setCode = DAILY_LUCK_SET_CODES[0];

  assert.equal(
    getDailyLuckReferenceValueKrw(setCode, [createCard({ price_ref_krw: 99_999 })]),
    DAILY_LUCK_UNLISTED_CARD_CAP_KRW,
    '출처에 없는 AR 이상 카드는 기존 참고가가 높아도 1,000원까지만 반영해야 함',
  );
  assert.equal(
    getDailyLuckReferenceValueKrw(setCode, [createCard({ price_ref_krw: null })]),
    DAILY_LUCK_UNLISTED_CARD_CAP_KRW,
    '출처와 기존 참고가가 모두 없는 AR 이상 카드도 1,000원으로 계산해야 함',
  );
  assert.equal(
    getDailyLuckReferenceValueKrw(setCode, [createCard({ rarity: 'C', price_ref_krw: 99_999 })]),
    0,
    '오늘의 운 합계에는 AR 미만 카드가 들어가면 안 됨',
  );

  const abyssEye = readSet('m5-abyss-eye');
  const abyssEyePrices = dailyLuckPriceData.sets['m5-abyss-eye'].pricesByNumber;
  const grunt = abyssEye.cards.find(
    (card) => card.name_ko === '녹청파의 조무래기' && card.rarity === 'SR',
  );
  const muku = abyssEye.cards.find(
    (card) => card.name_ko === '무쿠' && card.rarity === 'SR',
  );
  assert.ok(grunt && muku, '어비스아이 카드명 회귀 검증 대상을 찾지 못함');
  assert.equal(abyssEyePrices[String(grunt.number)], 2_000);
  assert.equal(abyssEyePrices[String(muku.number)], 10_000);

  const reportedResult = [
    ['크러시해머', 'SR'],
    ['라란티스 ex', 'SR'],
    ['녹청파의 조무래기', 'SR'],
    ['콘치', 'AR'],
    ['썬더볼트', 'AR'],
    ['야도란', 'AR'],
  ].map(([name, rarity]) => {
    const card = abyssEye.cards.find(
      (candidate) => candidate.name_ko === name && candidate.rarity === rarity,
    );
    assert.ok(card, `어비스아이 제보 결과 카드를 찾지 못함: ${name} ${rarity}`);
    return card;
  });
  assert.equal(
    getDailyLuckReferenceValueKrw('m5-abyss-eye', reportedResult),
    13_000,
    '제보된 어비스아이 결과의 참고가가 다시 과대 계산됨',
  );
}

function validateBoxResults() {
  let simulations = 0;
  const gradeOrder = {
    worst: 0,
    bad: 1,
    future: 2,
    small: 3,
    good: 4,
    blessing: 5,
    great: 6,
    legendary: 7,
  } as const;
  for (const setCode of DAILY_LUCK_SET_CODES) {
    const set = readSet(setCode);
    const priceSet = dailyLuckPriceData.sets[
      setCode as keyof typeof dailyLuckPriceData.sets
    ];
    assert.ok(priceSet, `${setCode}: 한국판 기준가 데이터가 필요함`);
    assert.equal(priceSet.pricedCards, Object.keys(priceSet.pricesByNumber).length);
    assert.ok(priceSet.pricedCards > 0, `${setCode}: 확인된 카드 기준가가 없음`);
    assert.equal(priceSet.boxPriceKrw, set.box_price_krw, `${setCode}: 박스 정가 불일치`);
    assert.ok(set.luck_value_ref, `${setCode}: 가치 운 기준 데이터가 필요함`);
    const valueGrades: Array<{ grade: keyof typeof gradeOrder; value: number }> = [];
    for (let sample = 0; sample < SAMPLES_PER_SET; sample += 1) {
      const box = simulateBox(
        set.cards,
        set.box_size,
        set.type,
        set.pack_size,
        `daily-box-validation:${setCode}:${sample}`,
        set.code,
      );
      const cards = box.packs.flatMap((pack) => pack.cards);
      assert.equal(box.packs.length, set.box_size, `${setCode}: 박스 팩 수 불일치`);
      assert.ok(cards.length >= set.box_size * set.pack_size, `${setCode}: 카드 수 부족`);
      const score = summarizeWeightedLuckEvent(
        cards,
        createLuckOpening(set, { boxes: DAILY_LUCK_BOX_COUNT }),
        set,
      );
      assert.ok(score, `${setCode}: 가치 운 계산 실패`);
      assert.ok(score.valuePercentile >= 0 && score.valuePercentile <= 1);
      const resultCards = cards.filter(isDailyLuckResultCard);
      assert.ok(resultCards.length > 0, `${setCode}: AR 이상 결과 카드가 없음`);
      const referenceValueKrw = getDailyLuckReferenceValueKrw(setCode, resultCards);
      assert.ok(referenceValueKrw > 0, `${setCode}: 박스 기준가 합계가 0원임`);
      const result: DailyLuckResult = {
        boxCount: DAILY_LUCK_BOX_COUNT,
        boxPriceKrw: priceSet.boxPriceKrw,
        packCount: box.packs.length,
        packCardNums: box.packs.map((pack) => pack.cards.map((card) => card.card_num)),
        hitCardNums: resultCards.map((card) => card.card_num),
        rarityCounts: box.summary,
        hitCount: resultCards.length,
        topCardNum: resultCards[0]?.card_num ?? null,
        topRarity: resultCards[0]?.rarity ?? null,
        observedValueKrw: referenceValueKrw,
        scorePercentile: score.valuePercentile ?? 0,
        totalCards: cards.length,
      };
      const fortune = getDailyLuckFortune({
        rank: 1,
        publicName: '검증',
        nicknamePublic: false,
        openedAt: `2026-08-13T00:${String(sample).padStart(2, '0')}:00.000Z`,
        result,
      }, '2026-08-13');
      valueGrades.push({ grade: fortune.grade, value: referenceValueKrw });
      const payload = JSON.stringify({
        boxCount: DAILY_LUCK_BOX_COUNT,
        packCount: box.packs.length,
        packCardNums: box.packs.map((pack) => pack.cards.map((card) => card.card_num)),
        hitCardNums: resultCards.map((card) => card.card_num),
        rarityCounts: box.summary,
      });
      assert.ok(Buffer.byteLength(payload, 'utf8') <= 32_768, `${setCode}: 결과가 32KB를 넘음`);
      simulations += 1;
    }
    valueGrades.sort((left, right) => left.value - right.value);
    for (let index = 1; index < valueGrades.length; index += 1) {
      assert.ok(
        gradeOrder[valueGrades[index].grade] >= gradeOrder[valueGrades[index - 1].grade],
        `${setCode}: ${valueGrades[index - 1].value}원보다 높은 `
        + `${valueGrades[index].value}원 결과의 운세가 낮아짐`,
      );
    }
  }
  return simulations;
}

function validateMigration() {
  const path = fileURLToPath(new URL(
    '../supabase/migrations/20260813000014_daily_box_fortune.sql',
    import.meta.url,
  ));
  const sql = readFileSync(path, 'utf8');
  assert.match(sql, /primary key \(day_kst, user_id\)/i);
  assert.match(sql, /revoke all on table public\.daily_luck_runs from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, delete on table public\.daily_luck_runs to service_role/i);
  assert.match(sql, /where ranked\.rank <= 10/i);
  assert.match(sql, /where day_kst < new\.day_kst - 30/i);
  const publicLeaderboard = sql.match(/'leaderboard'[\s\S]*?'mine'/)?.[0] ?? '';
  assert.match(publicLeaderboard, /'hitCardNums'/);
  assert.doesNotMatch(publicLeaderboard, /'scorePercentile'/);
}

validateRotation();
validateFortunes();
validateReferencePriceFallbacks();
const simulations = validateBoxResults();
validateMigration();

console.log(
  `Daily box fortune validation passed: ${DAILY_LUCK_SET_CODES.length} sets, `
  + `${simulations} boxes, ${DAILY_FORTUNE_VARIATION_COUNT.toLocaleString()} copy combinations.`,
);
