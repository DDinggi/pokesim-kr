# 썬&문 봉입률 근거 검토 — 2026-09-08

대상은 현재 등록된 `series: SM` **31개 상품**이다. THE BEST OF XY는 XY 세대이므로 이 검토 대상이 아니다. 한국판 공식 봉입률은 비공개이며 아래는 일본 자료를 참고한 시뮬레이션 추정치다. **31개를 검토했다는 뜻이지 31개 모두 실측 검증을 끝냈다는 뜻은 아니다.**

## 적용 기준

- 사용자 요청에 따라 재판 자료를 우선 탐색하되 대규모 표본이나 완전 일치를 필수로 요구하지 않는다. 이번 조사에서 세트별 초판/재판을 분리해 빈도까지 산출할 만한 재판 자료는 확보하지 못했다. 최신 갱신일의 웹 문서도 재판 통계라는 뜻은 아니다.
- SM3H/N·SM4S/A의 SR+ 1장 규칙은 초판 기준 폴백이다. [공식 SM3 안내](https://www.pokemon-card.com/info/2017/20170515_000730.html), [공식 SM4 안내](https://www.pokemon-card.com/products/sm/sm4.html), [초판/재판 설명](https://pokemon-infomation.com/pokemoncard-diary-sr-definition/)을 구분해서 참고했다. 재판 SR+ 없는 박스의 발생률은 미확인이라 임의의 0장 확률을 넣지 않았다.
- 근거는 구성 확인과 빈도 추정을 구분한다. 단일 박스에서 UR이 안 나왔다고 UR 확률을 0으로 만들지 않는다. 카톤당 13장/12박스라는 정리는 총 조사 표본 12박스를 뜻하지 않는다. 혼합 추정 모델의 `_sample_size`는 모두 `null`이며 단일/5박스 사례는 해당 항목 설명에만 기록한다.
- 한국판 팩 수·장수는 기존 한국 상품 데이터를 유지한다. 일본 박스의 히트 수를 한국 박스에 적용한 것은 **적응 모델**이지 한일 봉입률이 같다는 실측 결과가 아니다. C/U/R·미러·에너지 전체 분포는 이번에 모두 교정하지 않았다.

## 숫자를 수정한 7개 세트

| 세트 | 기존 | 이번 적용 |
| --- | --- | --- |
| 어둠을 밝힌 무지개 / 빛을 삼킨 어둠 | SR/HR/UR 약 46.15/30.77/23.08% | 고레어 슬롯 내 70/20/10% |
| 각성의 용사 / 초차원의 침략자 | SR/HR/UR 약 41.67/33.33/25% | 고레어 슬롯 내 70/20/10% |
| 미라클트윈 | SR/HR/UR 약 57.14/28.57/14.29% | 기본·추가 고레어 슬롯 각각 70/20/10% |
| 리믹스바우트 | SR/HR/UR 56.25/25/18.75% | 기본·추가 고레어 슬롯 각각 70/20/10% |
| 빛나는 전설 | RR 고정 2장 | RR 2~3장, 세 번째 장 50% 근사 |

[각성의 용사 공개 표](https://altema.jp/pokemoncard/kakuseinoyusha)와 [미라클트윈 공개 표](https://altema.jp/pokemoncard/miracletwin)의 HR 약 1/5박스·UR 약 1/10박스를 참고하여 하나의 고레어 슬롯을 70/20/10으로 배분했다. SR 70%는 남은 비중으로 계산한 **모델 추론**이다. SM3와 리믹스바우트는 인접 세트 차용이다. 추가 고레어 슬롯까지 있는 세트에서는 최종 박스당 HR·UR 기대값이 20%·10%보다 높아진다. SR 내부는 카드 종류 수로 나누지만 **SR/HR/UR 전체를 카드 종류 수로 배분하지 않는다**. SA의 독립 빈도는 추가 검증하지 않았다.

각성의 용사 표의 RR 4~5장은 [각 세트 5박스 개봉](https://pokecanews.com/archives/3758)의 RR 3장과 충돌하여 채택하지 않았다. 같은 출처의 모든 수치를 일괄 복사하지 않는다.

빛나는 전설은 [당시 개봉 정리](https://ameblo.jp/pokemon-card-densetu/entry-12293017203.html)의 RR 2~3장 범위 중간값을 사용한다. SR+ 1~2박스당 1장 → `1/1.5 = 2/3` 근사와 빛나는 카드 2장은 유지한다. 시크릿 10종 균등 가정은 저신뢰로 남긴다. 특히 뮤츠 GX 82번 확률을 실측했다고 주장하지 않는다. HR 기대값 약 0.267장/박스는 당시 HR 3~5박스당 1장 범위 안이다.

## 전 상품 근거 및 남은 한계

아래는 핵심 구성 근거다. 정확한 URL 목록·판본·신뢰도·모델 수치는 각 JSON의 `box_guarantees.pull_rate_review`에 함께 저장한다. `_superseded_source`는 변경 전 출처의 이력이며 현재 채택한 모델 설명이 아니다.

| 상품 | 검토 근거 / 판단 |
| --- | --- |
| 어둠을 밝힌 무지개 | [직접 2박스 개봉](https://pokecanews.com/archives/3096), [추가 개봉](https://www.houhou-news.com/tatakauniziwomitaka-kaihuu-list). 초판 SR+ 1·RR 3, 고레어 비중은 SM4 차용. |
| 빛을 삼킨 어둠 | [직접 1박스 개봉](https://www.houhou-news.com/hikariwokurauyami-kaihuu-list). 초판 SR 1·RR 3 구성, 빈도 표본으로 확대 해석하지 않음. |
| 각성의 용사 / 초차원의 침략자 | [각 5박스 기록](https://pokecanews.com/archives/3758). 초판 기준 RR 3·고레어 1 유지, 재판 미봉입 빈도는 미확인. |
| 빛나는 전설 | [단일 박스](https://www.houhou-news.com/hikarudennsetu-kaihuu-list)에서도 고레어 0장 가능. 위 범위 근사 적용, 개별 시크릿 확률 낮은 신뢰도. |
| 울트라썬 | [당시 개봉 정리](https://www.houhou-news.com/ultra-sun-kaihuu-list) RR 3~4와 [공개 표](https://altema.jp/pokemoncard/gacha/70) 4~5가 충돌. 기존 4~5 유지, 확인 완료 아님. |
| 울트라문 | [직접 개봉](https://www.houhou-news.com/ultra-moon-kaihuu-list) 구성 참고. RR·추가 고레어 빈도는 울트라썬 공통 모델 차용. |
| 울트라포스 | [직접 개봉 표](https://www.houhou-news.com/ultra-force-kaihuu-list) RR 3·PR 1·SR 1. 아고용 SR을 RR에 중복 집계하지 않음. 기존 3~4 유지. |
| 금단의 빛 | [개봉 기록](https://www.houhou-news.com/forbidden-light-kaihuu-list), [공개 표](https://altema.jp/pokemoncard/kindannohikari). 기존 RR 4~5·PR 1 유지. |
| 드래곤스톰 | [개봉 기록](https://www.houhou-news.com/dragon-storm-kaihuu-list). RR 3·PR 1·SR 1, 변동 슬롯은 동시대 추정 차용. |
| 챔피언로드 | [개봉 기록](https://www.houhou-news.com/champion-road-kaihuu-list). RR 3·SR 1, PR 없음 유지. |
| 창공의 카리스마 | [개봉 정리](https://www.houhou-news.com/rekkuu-no-charisma-kaihuu-list). RR 3~4·PR 1 유지. |
| 전뢰스파크 | [개봉 정리](https://www.houhou-news.com/jinrai-spark-kaihuu-list). RR 3~4·PR 1 유지, 드문 PR 2장 빈도 미확인. |
| 페어리라이즈 | [개봉 정리](https://www.houhou-news.com/pokemon-card-fairy-rise-kaihuu-list). RR 3~4·PR 1 유지, 추가 PR 빈도 미확인. |
| 버스트임팩트 | [개봉 정리](https://www.houhou-news.com/pokemon-card-super-burst-impact-kaihuu-list). RR 3~4·PR 1 유지. |
| 다크오더 | [개봉 기록](https://www.houhou-news.com/pokemon-card-dark-order-kaihuu-list). 구성 유지, 변동 빈도는 공통 추정. |
| 태그볼트 | [개봉 정리](https://www.houhou-news.com/pokemon-card-tag-bolt-kaihuu). 고레어 1~2·RR 3~4 유지. SA 25%·TR 고정 1은 기존 근사, 독립 검증 아님. |
| 나이트유니즌 | [당시 개봉 종합](https://www.houhou-news.com/pokemon-card-night-unison-kaihuu). 고레어 1~2·RR 3~4·TR 1~2 유지. |
| 풀메탈월 | [세트 개봉 자료](https://pokecardlab.com/2019/02/01/9455/) 접근에 제약. 나이트유니즌 등 인접 강화팩 모델 차용 유지, 자체 빈도 미확인. |
| 더블블레이즈 | [개봉 종합](https://www.houhou-news.com/pokemon-card-double-blaze-kaihuu). 고레어 1~2·RR 3~4·TR 1~2 유지. |
| 지지엔드 | [개봉 종합](https://www.houhou-news.com/pokemon-card-g-g-end-kaihuu). 고레어 1~2·RR 3~4·TR 1~2 유지. |
| 스카이레전드 | [개봉 종합](https://www.houhou-news.com/pokemon-card-sky-legend-kaihuu). 고레어 1~2·RR 3~4·TR 1~2 유지. |
| 미라클트윈 | [공개 확률 표](https://altema.jp/pokemoncard/miracletwin). 70/20/10 고레어 배분으로 교정. 추가·보조 슬롯은 동시대 카톤 모델. |
| 리믹스바우트 | [당시 15팩 분석](https://pokecanews.com/archives/10559) SR+ 0.54·RR 1.67·TR 0.54. 기존 30팩 기대값과 부합, 고레어 배분 교정. |
| 드림리그 | [카톤 추정](https://pokecanews.com/archives/11066) 고레어 13/12·RR 40/12, CHR 박스 3장 유지. |
| 얼터제네시스 | [카톤 추정](https://pokecanews.com/archives/11440) 고레어 13/12·RR 40/12·TR 13/12 유지. |
| GX 배틀부스트 | [공식 상품 구성](https://www.pokemon-card.com/products/sm/sm4p.html), [고레어 공개 추정](https://mba-international.jp/article/gxbattleboost_osusume/). 한국 15팩 적응 모델 유지, 한일 동일 수치 확인 아님. |
| GX배틀부스트 REMASTER | [한국 별도 상품](https://pokemoncard.co.kr/card/151). 일본 재판과 동일시 불가. RR 18·고레어 1~2는 기존 저신뢰 적응 모델, 직접 빈도 근거 부족. |
| GX 울트라샤이니 | [당시 개봉 종합](https://www.houhou-news.com/pokemon-card-gx-ultra-shiny-kaihuu). 기존 추가 SR 35%·UR 15%는 공개 범위 내, SSR 1·RR 9·S/PR 1~2 유지. |
| TAG TEAM GX 태그올스타즈 | [당시 개봉 종합](https://pokecanews.com/archives/12186). 고레어·에너지 SR 구성 유지. 기존 SR10 갓팩 약 1/250팩은 유지하지만 이번 자료로 발생 빈도를 새로 검증한 것은 아님. |
| 명탐정 피카츄 | [직접 1박스 개봉](https://www.houhou-news.com/pokemon-card-movie-special-pack-meitantei-pikachu-kaihuu) SR 1·RR 4. 기존 균등 홀로 풀의 RR 기대값 2.375와 차이 있음. 단일 결과로 RR 4장 고정을 만들지 않고 미검증 표시. |

추가 고레어 1/12는 [일반 2장 박스 조사](https://pokemon-infomation.com/pull-rates-nimaibako/)의 약 8~10% 설명 및 동시대 카톤 정리를 참고한 공통 근사다. 세대·세트별 편차가 있으므로 모든 SM 재판의 실측 8.33%라고 표기하지 않는다. RR 추가 1/3·TR 추가 1/12도 카톤 모델에서 다른 세트에 차용한 경우를 명시한다.

## 재현 및 검증

```powershell
pnpm --dir scripts review:sm-rates                 # dry run, SM 전체 누락 검사
pnpm --dir scripts review:sm-rates -- --write      # 출처/규칙/스냅샷만 갱신
pnpm --dir scripts review:sm-rates -- --check      # 현재 모델과 일치 검사
pnpm --dir scripts validate:box-guarantees -- --set <code> --trials 1000
pnpm --dir scripts validate:luck -- --all --strict
pnpm --dir scripts build:luck-dist -- --set <숫자 변경 세트>
pnpm --dir scripts sync -- --set <code>
```

`model.ts`의 공통 모델을 박스·1팩/자판기·운 계산이 공유한다. 검증은 코드의 슬롯 제약·기대값 정합성 및 공개 데이터 일치를 확인하며 실물 봉입률을 증명하지 않는다. Git 커밋·push·PR·배포는 수행하지 않는다.
