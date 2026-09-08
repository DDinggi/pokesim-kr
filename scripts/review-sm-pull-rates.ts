/** Reviewed evidence registry, not a scraper. Default: check coverage and show a dry run.
 * --write updates SM provenance/rules only; --check checks stored provenance against the model.
 * Follow with sync and build:luck-dist for sets whose numeric model changed.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import modelDefault from '../frontend/lib/simulation/model.ts';

const { getStandardSvSetRate } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const date = '2026-09-08';
const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.some((arg) => !['--write', '--check'].includes(arg)) || args.length > 1) {
  throw new Error('Use no flag (dry run), --write, or --check');
}
const opening = (path: string) => `https://www.houhou-news.com/${path}`;
const news = (id: number) => `https://pokecanews.com/archives/${id}`;
const commonSources = [
  'https://altema.jp/pokemoncard/kakuseinoyusha',
  'https://altema.jp/pokemoncard/miracletwin',
  'https://pokemon-infomation.com/pull-rates-nimaibako/',
];
const commonNotes = '한국판 공식 봉입률은 비공개. 일본판 공개 추정치를 한국 박스 구성에 준용한다. 일반 SM의 SR/HR/UR 70/20/10은 고레어 슬롯 내 근사 배분이며, SR 내부 카드별/SA 확률은 별도 실측이 아니다. 추가 고레어 1/12와 RR·TR 변동치는 해당 세트별 대규모 실측이 아니라 동시대 박스·카톤 추정 모델을 차용한 값이다. C/U/R·미러·에너지 전체 분포까지 검증한 것은 아니다.';
type Entry = { sources: string[]; notes: string; print?: string; confidence?: string };
const entries: Record<string, Entry> = {};
function add(codes: string[], paths: string[], notes: string, print = '재판 구분 없는 자료 / 발매 당시 개봉 기록', confidence = '중간: 구성 근거, 빈도는 추정') {
  for (const code of codes) {
    if (entries[code]) throw new Error(`Duplicate evidence: ${code}`);
    entries[code] = { sources: paths, notes, print, confidence };
  }
}
const earlyPrint = '초판 기준 폴백: 재판 SR+ 미봉입 빈도 미확인';
const earlySources = ['https://pokemon-infomation.com/pokemoncard-diary-sr-definition/'];
add(['sm3h-rainbow-in-darkness'], [news(3096), opening('tatakauniziwomitaka-kaihuu-list'), 'https://www.pokemon-card.com/info/2017/20170515_000730.html', ...earlySources], '초판 SR+ 1장, RR 3장 구성. SM4의 HR 20%·UR 10% 공개 추정치를 인접 세트에 차용. 재판에서 고레어 없는 박스가 있다는 설명만으로 발생률을 만들지 않는다.', earlyPrint, '낮음: 고레어 세부 빈도는 인접 세트 차용');
add(['sm3n-darkness-devours-light'], [opening('hikariwokurauyami-kaihuu-list'), 'https://www.pokemon-card.com/info/2017/20170515_000730.html', ...earlySources], '직접 개봉 1박스에서 SR 1장·RR 3장. 초판 SR+ 구성은 공식 안내로 보강. 고레어 배분은 SM4 추정치 차용이며 1박스 표본에서 산출하지 않는다.', earlyPrint, '낮음: 고레어 세부 빈도는 인접 세트 차용');
add(['sm4s-awakened-heroes', 'sm4a-ultradimensional-beasts'], [news(3758), 'https://www.pokemon-card.com/products/sm/sm4.html', ...earlySources], '각 세트 5박스씩 개봉 기록에서 SR+ 1장·RR 3장. 합계 10박스를 세트별 표본으로 중복 계산하지 않는다. 공개 표의 HR 1/5·UR 1/10만 근사 배분에 채택; RR 4~5라는 표는 실제 개봉과 충돌하므로 채택하지 않는다.', earlyPrint);
add(['sm3plus-shining-legends'], ['https://ameblo.jp/pokemon-card-densetu/entry-12293017203.html', opening('hikarudennsetu-kaihuu-list')], '빛나는 카드 2장, RR 2~3장, SR+ 1~2박스당 1장이라는 당시 정리를 준용. RR 추가 50%는 범위 중간값, 고레어 2/3은 1/1.5박스 근사. 시크릿 10종 균등 선택은 저신뢰 가정(뮤츠 GX 82번 독립 실측 없음). HR 기대값 약 0.267장은 공개 범위 1/3~1/5박스 안에 든다.', '발매 당시 자료 폴백 / 재판별 발생률 미확인', '낮음: 범위 근사, 시크릿 개별 확률 미확인');
add(['sm5s-ultra-sun'], [opening('ultra-sun-kaihuu-list'), 'https://altema.jp/pokemoncard/gacha/70'], 'PR 1장·SR+ 1장 구성. RR 3~4라는 당시 설명과 4~5라는 공개 표가 충돌한다. 기존 RR 4~5 모델을 유지하되 세트별 빈도 확인 완료로 표시하지 않는다.', undefined, '낮음: RR 출처 간 불일치');
add(['sm5m-ultra-moon'], [opening('ultra-moon-kaihuu-list')], 'PR 1장·고레어 구성은 개봉 기록 참고. RR 4~5와 추가 슬롯 빈도는 울트라썬 공통 모델을 차용; 이 자료 하나로 빈도까지 검증하지 않는다.', undefined, '낮음: 공통 모델 차용');
add(['sm5plus-ultra-force'], [opening('ultra-force-kaihuu-list')], '직접 개봉은 RR 파르키아·아고용·디아루가 각 1장, 아고용 SR 1장, PR 1장. 아고용 SR을 RR로 중복 집계하지 않는다. RR 3~4 기존 모델 유지. 한국 20팩×8장에 일본 히트 수를 준용.');
add(['sm6-forbidden-light'], [opening('forbidden-light-kaihuu-list'), 'https://altema.jp/pokemoncard/kindannohikari'], 'RR 4장 개봉 사례와 공개 4~5장 추정, PR 1장에 맞는 기존 모델 유지.');
add(['sm6a-dragon-storm'], [opening('dragon-storm-kaihuu-list')], 'RR 3장·PR 1장·SR 1장 개봉 기록. 한국 20팩×8장에 일본 박스 히트 수 준용; 추가 RR·고레어 빈도는 공통 추정.');
add(['sm6b-champion-road'], [opening('champion-road-kaihuu-list')], 'RR 3장·SR 1장 개봉 기록. PR 없는 구성 유지; 추가 슬롯 빈도는 공통 추정.');
add(['sm7-sky-charisma'], [opening('rekkuu-no-charisma-kaihuu-list')], '당시 RR 3~4장·PR 1장 정리와 부합. PR 2장 빈도 미확인으로 추가 PR은 모델링하지 않는다.');
add(['sm7a-plasma-spark'], [opening('jinrai-spark-kaihuu-list')], 'RR 3장·PR 1장·SR 1장 사례와 RR 3~4장 정리. 드문 PR 2장 빈도 미확인으로 추가 PR은 모델링하지 않는다.');
add(['sm7b-fairy-rise'], [opening('pokemon-card-fairy-rise-kaihuu-list')], 'RR 3장·PR 1장·SR 1장 사례. 드문 RR 4장·PR 2장 언급 중 PR 2장 빈도는 미확인; 기존 PR 1장 모델 유지.');
add(['sm8-burst-impact'], [opening('pokemon-card-super-burst-impact-kaihuu-list')], 'RR 4장·PR 1장·SR 1장 사례와 RR 3~4장 정리에 부합.');
add(['sm8a-dark-order'], [opening('pokemon-card-dark-order-kaihuu-list')], 'RR 3장·PR 1장·고레어 구성 참고. 추가 슬롯 빈도는 공통 추정 유지.');
add(['sm9-tag-bolt'], [opening('pokemon-card-tag-bolt-kaihuu')], 'RR 3~4장·고레어 1~2장 구성 참고. SA 25% 및 TR 고정 1장은 기존 근사이며 별도 빈도 검증 아님.');
add(['sm9a-night-unison'], [opening('pokemon-card-night-unison-kaihuu')], '당시 RR 3~4장·TR 1~2장·고레어 1~2장 정리와 부합. 카톤 내 2고레어 박스 사례는 빈도 추정 보조.');
add(['sm9b-full-metal-wall'], ['https://pokecardlab.com/2019/02/01/9455/', opening('pokemon-card-night-unison-kaihuu')], '동시대 나이트유니즌·더블블레이즈의 RR 3~4·TR 1~2·고레어 1~2 공통 모델 유지. 풀메탈월 자체 대량 빈도는 확보하지 못함.', undefined, '낮음: 인접 강화팩 모델 차용');
add(['sm10-double-blaze'], [opening('pokemon-card-double-blaze-kaihuu')], 'RR 3~4장·TR 1~2장·고레어 1~2장 공개 정리에 부합.');
add(['sm10a-gg-end'], [opening('pokemon-card-g-g-end-kaihuu')], 'RR 3~4장·TR 1~2장·고레어 1~2장 공개 정리에 부합.');
add(['sm10b-sky-legend'], [opening('pokemon-card-sky-legend-kaihuu')], 'RR 3~4장·TR 1~2장·고레어 1~2장 공개 정리에 부합.');
add(['sm11-miracle-twin'], ['https://altema.jp/pokemoncard/miracletwin', news(11066)], 'SR/HR/UR 배분을 카드 종류 수 12:6:3에서 70:20:10으로 교정. RR·TR·추가 고레어는 동시대 카톤 추정 모델 유지. SA 하위 확률은 별도 보정하지 않음.');
add(['sm11a-remix-bout'], [news(10559), opening('remix-bout-kaihuu')], '15팩 기대치 SR+ 0.54·RR 1.67·TR 0.54라는 당시 분석은 기존 30팩 모델과 부합. 고레어 종류 수 9:4:3 배분 대신 인접 미라클트윈의 70:20:10 차용.');
add(['sm11b-dream-league'], [news(11066)], '당시 카톤 단위 추정 SR+ 13/12박스·RR 40/12박스·박스 CHR 3장을 유지. 분모 12는 카톤 환산 단위이지 총 조사 표본 수가 아니다.');
add(['sm12-alter-genesis'], [news(11440)], '당시 카톤 단위 추정 SR+ 13/12박스·RR 40/12박스·TR 13/12박스를 유지. 분모 12를 실측 표본 크기로 표기하지 않는다.');
add(['sm4plus-gx-battle-boost'], ['https://www.pokemon-card.com/products/sm/sm4p.html', 'https://mba-international.jp/article/gxbattleboost_osusume/'], '팩당 GX와 박스 고레어 구성 참고. HR 20%·UR 10% 공개 추정에 맞는 기존 고레어 배분 유지. 한국 15팩×10장과 일본 10팩×7장의 차이는 박스 단위 적응 모델이며 동일 봉입률 확인 아님.', undefined, '낮음: 한국 박스 구성 차이');
add(['sm4plus-gx-battle-boost-remaster'], ['https://pokemoncard.co.kr/card/151', 'https://www.pokemon-card.com/products/sm/sm4p.html'], '한국 전용 REMASTER를 일본 GX 배틀부스트 재판과 동일시하지 않는다. 상품 구성 근거만 확보. RR 18장·고레어 1~2장 및 세부 확률은 기존 저신뢰 적응 모델 유지, 직접 봉입 빈도 미확인.', '한국 별도 상품 / 대응 일본 재판 자료 없음', '낮음: 봉입 빈도 직접 근거 부족');
add(['sm8b-gx-ultra-shiny'], [opening('pokemon-card-gx-ultra-shiny-kaihuu'), 'https://pokecardlab.com/2018/11/03/4534/'], 'SSR 1장·RR 9장·S 1~2장·PR 1~2장 구성 유지. 당시 SR 2~3박스당 1장, UR 6~7박스당 1장 범위에 맞춰 기존 추가 SR 35%·UR 15%·없음 50% 유지. 둘이 없으면 S 추가라는 슬롯 상관관계는 근사.');
add(['sm12a-tag-team-gx-tag-all-stars'], [news(12186)], '일반 박스 고레어 1장 이상·에너지 SR 1장 구성 확인. 기존 SR10 갓팩 1/250팩 모델과 특수팩 출처는 보존; 이번 개봉 기사만으로 갓팩 빈도를 새로 검증한 것은 아니다.');
add(['smp2-detective-pikachu'], [opening('pokemon-card-movie-special-pack-meitantei-pikachu-kaihuu')], '직접 개봉은 일본 20팩×4장, SR 1장·RR 4장. 한국 20팩×5장 all-holo 모델의 SR 1장 유지. RR 기대값 2.375는 기존 균등 홀로 풀 가정으로 사례와 다르며 빈도 미검증; 단일 박스로 고정 4장을 만들지 않는다.', undefined, '낮음: RR 빈도 및 한일 팩 구성 차이');

const sets = readdirSync(resolve(root, 'data/sets')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(root, 'data/sets', f), 'utf8')))
  .filter((set) => set.series === 'SM');
if (sets.length !== Object.keys(entries).length || sets.some((set) => !entries[set.code])) {
  throw new Error('SM evidence coverage changed: review all registered SM sets before writing');
}
let changed = 0;
for (const set of sets) {
  const entry = entries[set.code];
  const rate = getStandardSvSetRate(set.code);
  const sources = [...new Set([...entry.sources, ...(rate && !['smp2-detective-pikachu', 'sm3plus-shining-legends'].includes(set.code) ? commonSources : [])])];
  const review = {
    reviewed_at: date,
    status: 'estimated',
    print_basis: entry.print,
    confidence: entry.confidence,
    sources,
    notes: entry.notes,
    assumptions: commonNotes,
    model_snapshot: rate ?? null,
    report: 'docs/sm-pull-rate-review.md',
  };
  const previous = set.box_guarantees ?? {};
  let rules = previous.rules ?? [];
  if (rate && !['smp2-detective-pikachu', 'sm3plus-shining-legends'].includes(set.code)) {
    rules = [
      { rarity: 'RR', min: rate.rrBaseCount, max: rate.rrBaseCount + (rate.rrExtraRate > 0 ? 1 : 0) },
      { rarity: 'SR/HR/UR', min: 1, max: 1 + (rate.extraHighRate > 0 ? 1 : 0) },
    ];
    if (rate.prCount) rules.push({ rarity: 'PR', min: rate.prCount, max: rate.prCount });
    if (rate.trCount) rules.push({ rarity: 'TR', min: rate.trCount, max: rate.trCount + ((rate.trExtraRate ?? 0) > 0 ? 1 : 0) });
    if (rate.chrCount) rules.push({ rarity: 'CHR', min: rate.chrCount, max: rate.chrCount });
  } else if (set.code === 'sm3plus-shining-legends') {
    // H includes the unmarked secret #82 as well as the guaranteed Shining cards.
    rules = [{ rarity: 'RR', min: 2, max: 3 }, { rarity: 'H', min: 2, max: 3 }, { rarity: 'SR/HR', min: 0, max: 1 }];
  }
  const next = {
    ...previous,
    _superseded_source: previous._superseded_source ?? previous._source ?? null,
    rules,
    _source: `${entry.print}. ${entry.notes} ${commonNotes} 출처: ${sources.join(' ; ')}`,
    _sample_size: null,
    _estimated_at: date,
    pull_rate_review: review,
  };
  if (JSON.stringify(previous) !== JSON.stringify(next)) {
    changed++;
    if (args.includes('--write')) {
      set.box_guarantees = next;
      writeFileSync(resolve(root, 'data/sets', `${set.code}.json`), JSON.stringify(set, null, 2) + '\n');
    }
  }
  console.log(`${set.code}: ${entry.confidence} / ${entry.print}`);
}
console.log(`${sets.length} SM sets covered; ${changed} ${args.includes('--write') ? 'updated' : 'pending'}; no external writes.`);
if (args.includes('--check') && changed) throw new Error('Stale SM provenance/model snapshot: review then run --write');
