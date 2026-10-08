# 초기 썬&문 6종 추가·대조 검토 — 2026-10-08

사용자 확인에 따라 개별 상품 6종을 추가했다. 한국판 공식 봉입률은 비공개다.
아래 구성·추정 모델·코드 검사 결과를 구분하며, 재판 실측이나 한국판 빈도 검증 완료로 표현하지 않는다.

## 상품 및 카드 범위

| 상품 / 코드 | 한국 상품 근거 | 한국 구성·정가 | 한국 이미지 / JP 보강 / 총 항목 |
| --- | --- | --- | --- |
| 새로운 시련 / `sm2plus-new-trials` | [공식 상품](https://pokemoncard.co.kr/card/110) | 2017-05-26 · 20팩×8장 · 20,000원 | 109 / 9 / 118 |
| 알로라의 햇빛 / `sm2k-alolan-sunlight` | [공식 상품](https://pokemoncard.co.kr/card/106) | 2017-04-20 · 30팩×5장 · 15,000원 | 55 / 7 / 62 |
| 알로라의 달빛 / `sm2l-alolan-moonlight` | [공식 상품](https://pokemoncard.co.kr/card/106) | 2017-04-20 · 30팩×5장 · 15,000원 | 55 / 7 / 62 |
| 강화 썬&문 / `sm1plus-sun-moon` | [공식 상품](https://pokemoncard.co.kr/card/103) | 2017-03-24 · 20팩×8장 · 20,000원 | 111 / 10 / 121 |
| 썬 컬렉션 / `sm1s-sun-collection` | [공식 상품](https://pokemoncard.co.kr/card/99) | 2017-02-09 · 30팩×5장 · 15,000원 | 66 / 7 / 73 |
| 문 컬렉션 / `sm1m-moon-collection` | [공식 상품](https://pokemoncard.co.kr/card/99) | 2017-02-09 · 30팩×5장 · 15,000원 | 66 / 7 / 73 |

총 **509개 항목: 한국 이미지 462 + 일본판 보강 47**. 미러·기본 에너지가 포함된 항목 수다.
강화 썬&문은 무등급 일반 44·미러 44·기본 에너지 9, 새로운 시련은 일반 43·미러 43·에너지 9다.
인쇄된 C/U/R이 없는 카드에 임의 등급을 붙이지 않는다. `validate:data`는 이 검토된 정확한 구성을
검사한 경우에만 다량 null 경고를 의도된 구성 정보로 처리한다.

한국 검색의 딜리버드 14번은 상세가 비어 수집되지 않았으나 [공식 원본](https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2K/SM2K_014.png)이 존재한다.
인쇄 번호·이름·C·HP90·물 타입을 직접 확인하여 한국 이미지로 복구했다.
보강 47장의 한국 실물 수록·한국 고레어 이미지 확보는 아직 미확인이다. 일본 목록 대응에 따른 폴백이다.
이름 근거는 [보강 manifest](../data/manual/sm-early-six-secrets.json)에 한국 공식 동일 카드 ID로 남겼다.

## 한국 왼쪽 / 일본 오른쪽 대조

```powershell
pnpm --dir scripts audit:comparison -- --set 'sm2plus-new-trials,sm2k-alolan-sunlight,sm2l-alolan-moonlight,sm1plus-sun-moon,sm1s-sun-collection,sm1m-moon-collection'
```

결과는 `.tmp/card-comparison/index.html`. 한국 인쇄 번호순 509행, 왼쪽 한국/오른쪽 일본이며
한국·일본 번호가 다르면 KR/JP를 각각 표시한다. 고레어만 보기·이름/번호 검색·원본 링크가 있다.
일본판만 보강된 항목은 일본 기준 번호이며 한국 인쇄 번호가 미확인임을 별도 표시한다.
한국 이미지가 없으면 왼쪽에 미확보를 표시하고 일본 보강 이미지를 한국판으로 위장하지 않는다.
한국 이미지는 R2 512 WebP를 로딩하며 클릭 시 원본을 연다. 미러는 별도 행, 기본 에너지는 일본
일반 번호에 억지로 연결하지 않는다. FullAhead의 묶음 상품 이미지를 여러 개별 번호로 확장하지 않는다.

대조된 일본 개별 번호는 각각 **66·62·62·68·73·73**, 누락 번호·등급 토큰 불일치 모두 0.
고레어 SR/HR/UR **84장**의 한국/일본 번호·일러스트·레어도를 이미지 시트로 육안 검토했다.
진단 시트는 `.tmp/review-high-<code>.png`에 남겼다. 브라우저 연결이 없어 HTML의 실제 클릭/반응형
렌더링 검수는 수행하지 못했으며, 생성 구조·대응 목록과 이미지 시트 검수로 대체했다.

[메타 교정 원장](../data/manual/sm-early-six-metadata-review.json):

- 새로운 시련 공식 DB `p_num`의 6개 잘못된 한국 번호를 원본 인쇄 번호로 교정했다.
  소원의 바통/약점보험 KR45/46 ↔ JP46/45, 라이치/아세로라 KR47/49 ↔ JP49/47,
  마마네/아세로라 SR KR56/57 ↔ JP57/56. 미러 대응에도 동일 매핑을 적용한다.
- 문 컬렉션 라란티스 GX 61번은 공식 상세의 U가 잘못되어 원본 인쇄 SR로 복구했다.
- 릴리에 SR KR65 ↔ JP66, 스컬단의 조무래기 SR KR66 ↔ JP65 등 트레이너 대응을 `_jp_number`로 보존한다.
  FullAhead 시세·커버리지 검사는 이를 사용한다. 번호만 같다고 서로 다른 카드의 가격을 붙이지 않는다.

## 봉입률: 근거와 명시적 근사

재판을 우선 찾았지만 이 6종의 재판별 발생 건수/분모는 확보하지 못했다. 표본 수는 전부 `null`.
초기 상품에 SM3 이후 SR+ 보장을 소급 적용하지 않는다.
[SR 보장 도입 시기 설명](https://pokemon-infomation.com/pokemoncard-diary-sr-definition/)과
[SM3 일본 공식 안내](https://www.pokemon-card.com/products/sm/sm3.html)를 참고했다.

| 상품 | 박스 RR / 고레어 모델 | 근거·차용 범위 |
| --- | --- | --- |
| 썬/문 컬렉션 | RR3~4, SR40%·HR20%·UR10%·없음30%, SR+0~1장 | [발매 당시 개봉 정리](https://ameblo.jp/pokemon-card-densetu/entry-12227296190.html)의 SR2~3박스당1장 범위 중간 역수 `1/2.5`. HR/UR는 [인접 SM4 공개표](https://altema.jp/pokemoncard/kakuseinoyusha)의 1/5·1/10 차용. 없음은 남은 비중, RR4장50%는 범위 중간 근사. |
| 알로라 햇빛/달빛 | RR3~4, SR40%·HR20%·UR10%·없음30% | [당시 구성](https://pokeudon.hatenablog.com/entry/2017/03/17/191953), [개봉](https://www.houhou-news.com/kimiwomatusimazima-kaihuu)과 초기 SM1 모델 차용. 해당 세트 빈도 실측 아님. |
| 새로운 시련 | RR3, SR40%·HR20%·UR10%·없음30% | [발매 당시 개봉 기록](https://perappu-johokyoku.blog.jp/archives/2017-04.html)의 RR3·고레어0장 사례는 가능 구성 참고일 뿐 확률 표본이 아님. 빈도는 초기 SM1 모델 차용. |
| 강화 썬&문 | RR3~4, SR22.222%·HR16.667%·UR10%·없음51.111% | [공개 저신뢰 추정](https://tradecard.jp/articles/ninnfiagx-hr)의 SR3~6박스·HR6박스·UR10박스. SR은 `1/4.5`; 서로 배타적인 0~1장 슬롯으로 근사. 자료의 불확실성을 유지. |

고레어 조건부 가중치 합계는 100이며 슬롯 발생률 `mandatoryHighRate`와 분리한다.
낱팩은 박스 기대 장수/팩 수로 환산한다. 추가 고레어·갓팩은 빈도 근거가 없어 추가하지 않았다.
SR 내 포켓몬/트레이너는 종류 수로 분할하고 각 풀은 균등 선택(개별 실측 아님).

한국 강화 썬&문의 공식 상품은 **8장 중 홀로1·기본 에너지1**이다.
[일본 SM1+](https://www.pokemon-card.com/products/sm/sm1p.html)의 5장 전 홀로 구성과 다르므로
한국은 일반6·기본 에너지1·홀로1로 구현했다. GX/고레어는 홀로를 대체하며 미러를 추가 동봉하지 않는다.
새로운 시련은 같은 한국 초기 강화팩 구조를 **차용**했다. 두 강화팩의 비히트 카드 균등 선택과 미러
상세 분포는 근사이며 실물 전수검증이 아니다. 박스·낱팩·운 계산에서 동일 슬롯 발생률을 사용한다.

## 시세·자산·검사 결과

- FullAhead 고레어 84장 가격 매칭 누락 0. 일본 판매 표시가 × 환율 × 한국 추정계수이며 한국 실거래가가 아니다.
  번호가 바뀐 릴리에·아세로라 등을 재매칭했다. 가격 다음 박스20,000/낱팩40,000회로 가치 운 분포를 재생성했다.
  강화 썬&문은 SR+ 없는 박스가 절반 이상이고 RR 참고가를 수집하지 않아 박스 중앙값0이다.
  가격0은 실물 가치0을 뜻하지 않으며 가치 운은 코드의 기대값 폴백을 사용한다.
- R2 원본 **509개**, 256/512 WebP **1,018개** 전수 검증: 누락·너비 오류·변환 실패 0.
  공식/보강 출처와 두 variant의 자동 이미지 비교에도 불일치가 없었다.
- 최초 한국판 단일 박스 6종은 [판매 이미지 출처 원장](../data/manual/sm-early-six-box-sources.json)을 따른다.
  2026-10-09 사용자 제공 커스텀 이미지·누끼 완료본으로 교체했다. 현재 출력은 투명768 PNG +
  **512 WebP**, 박스 높이는 PNG708px로 통일했다. 1024 원본과 500px 누끼 원본, 초기 판매 원본을
  `boxes/original/`에 각각 보존했다. 누끼500→PNG768은 업스케일이며 고해상도 실물 사진을 확보한 것은 아니다.
  THE BEST OF XY는 imagegen으로 옆면이 왼쪽에 보이도록 편집한 시안으로 교체했으며 제목은 정방향이다.
  [교체 원장·시안 프롬프트](../data/manual/box-image-replacements-20261009.json)에 입력 해시·변환·검증 근거를 기록했다.
  `validate:box-images -- --set '<6종 코드>,smxy-best-of-xy' --thumbnail 512`로 7쌍의 규격·알파·
  가운데 정렬·전경 크기·PNG/WebP 대응을 검증했고 WebP7종을 육안 확인했다. 공식 패키지 인쇄 문구
  전수검증이나 웹 브라우저 렌더링 검사를 수행했다는 뜻은 아니다.
- `audit:identity --images --variants-only`: 509개 검사. 일본 보강47개는 공식 상세 부재/비공식 ID로
  계속 미검증 표시. 딜리버드1개의 상세도 비어 있으나 공식 원본은 육안 검수했다.
  새로운 시련10개(기본6+미러4)의 DB 번호 불일치와 라란티스1개 등급 불일치는 위 원본 교정 근거로 설명한다.
  캐시는 `.tmp/card-identity-audit-20261008/`. 진단 종료코드0을 전체 공식 메타 통과라고 해석하지 않는다.
- `validate:data --set <code> --strict`: 6종 오류·경고0. `audit:coverage`: 6종 ok, 누락0.
- `validate:box-guarantees`: 각1,000박스. `validate:sm-early`: 각4,000박스+60,000낱팩에서 509장
  전체 도달성·팩 모양·강화팩 에너지/홀로1·미봉입·동일 시드·박스/낱팩 빈도·운 기대값·공개 사본 검사 통과.
- `review:sm-rates --check`: 37종 출처/모델 정합. `validate:luck --all --strict`: 102종 경고·오류0.
  각 신규 `validate:value-luck`, TypeScript, ESLint, Next 프로덕션 빌드 통과.
- 비교표 구조/필터 로직 검사: `validate:sm-early -- --comparison`의 DOM 스텁으로 509행·84장
  고레어 필터·릴리에 KR65/JP66 검색·원본 링크·한국 부재 표시를 검사했다. 브라우저 렌더링 검사는 아님.
- 별도로 실행한 기존 `validate:identity-review`는 스페이스 저글러 `BS2022008071` 가격 스냅샷
  103,700원과 현재72,900원 차이로 실패했다. 해당 데이터/검사 스크립트는 이번에 변경하지 않았고
  `git show HEAD:data/sets/s10p-space-juggler.json`도72,900원이다.
  `validate:chase-luck`의 블랙볼트/화이트플레어 BWR 점수0.955/0.982는 기준1.0에 미달했다.
  변경 전 main `luck.ts` 임시 복사본으로도 같은10건 결과와2건 실패를 재현했다. 기존 실패를 숨기거나
  통과시키기 위해 이번 신규 세트 작업에서 옛 가격/테스트 기준을 변경하지 않았다.
- active/UI/NEW10/8 공지 등록, 힛카드도감은 기존 최고 등급 및 그 이하10만원·트레이너 UR 제외 기준 유지.
  브랜치는 `feat/sm-early-six-card-comparison`; Git push·PR·main 머지·서비스 배포는 요청 전 실행하지 않는다.
