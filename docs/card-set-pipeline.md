# Card Set Pipeline

## 카드 정체성 전수 대조 (2026-09-10)

신규 수집·일본판 보강·가격 재매칭 후 `pnpm --dir scripts audit:identity -- --set <code>`로
공식 상세의 이름·번호·레어도·HP·타입·이미지 경로를 대조한다.
`--images --variants-only`를 추가하면 출처 이미지와 CDN 256/512 픽셀도 비교한다.
전체 active 상품은 `--set`을 생략한다. 캐시와 세트별 결과는 `.tmp/card-identity-audit/`에 저장된다.
이 명령은 진단 전용이며 오류가 있어도 데이터를 자동 수정하거나 업로드하지 않는다.
HTTP/공식 상세 부재와 이미지 비교 불가는 통과가 아니라 미검증이다.
픽셀 차이는 촬영·언어·크롭 차이일 수도 있어 직접 확인한다.

한국/일본 번호 순서가 다르면 이름만 고치지 않는다. 이미지와 시세까지 같은 카드로 맞추고
`data/prices/price-matches.json`의 `fullahead_number`에도 대응을 남겨 재수집 시 재발을 막는다.
레어도 누락은 D-150에 따라 데이터·등장 슬롯·운 계산을 함께 수정한다.
2026-09 전수검사 결과와 미해결 항목: [검토 보고서](card-identity-audit-20260910.md).

### 수정 후 검증 및 머지 체크리스트

1. 변경 전후 카드와 근거 URL을 `data/manual/` 검토 원장에 남긴다. 한국·일본 번호 차이는
   이름뿐 아니라 이미지·가격 대응을 검토한다. 등급/종류 변경 시 등장 풀과 운 모델도 확인한다.
2. 변경 세트마다 `audit:identity -- --set <code> --images --variants-only`를 실행한다.
   전체 감사는 `--set`을 생략한다. 결과의 불일치/미검증 목록을 직접 검토한다.
   **진단 명령의 종료 코드 0은 모든 카드 통과를 뜻하지 않는다.** 캐시는 시점별 증거이므로
   출처가 갱신됐는지 확인할 때는 기존 캐시 폴더를 별도 보관한 뒤 새 캐시로 실행한다.
3. `build:luck-dist -- --set <code>`로 영향 세트의 운 분포를 재생성하고 `sync`한다.
4. `validate:identity-review`, `validate:luck`, `validate:data -- --strict`,
   `validate:box-guarantees -- --set <code> --trials 1000`, 프론트 `tsc --noEmit`을 실행한다.
   회귀검사는 현재 검토한 4개 세트의 박스/낱팩 도달성을 검사하며 새 수정 세트는 테스트를 추가한다.
   가격 등 정상 갱신으로 검토 원장 스냅샷이 바뀌면 새 근거와 원장을 함께 갱신한다.
5. strict 경고, 출처 404, 공식 상세 부재는 실패/미검증 원인과 범위를 보고서에 명시한다.
   경고를 없애기 위해 미러·보강 카드를 임의 삭제하지 않는다.
6. 이번 감사는 `pnpm --dir scripts exec tsx export-card-identity-audit.ts`로 범위·해시·예외를 보존한다.
   이 내보내기는 2026-09 감사 전용이며 다음 감사는 날짜별 별도 보고서로 남긴다.
7. `git diff --check`와 포함 파일을 검토하고, 사용자가 게시를 요청한 경우에만 브랜치 push →
   PR → 상태 검사 확인 → main 머지한다. `.tmp` 캐시·개인 문서·시크릿은 커밋하지 않는다.

이 문서는 새 카드 세트를 추가할 때의 작업 순서를 고정하기 위한 운영 노트다.
카드 메타의 SSOT는 `data/sets/*.json`이고, 앱에서 읽는 사본은
`frontend/public/sets/*.json`이다. 한 번에 빠짐없이 따라갈 수 있는 **엔드투엔드 체크리스트**를
"전체 작업 순서"에 두고, 세부는 아래 전용 섹션에서 설명한다.

## 변경 이력

- **2026-09-17 로딩·조합·시세 감사** — M6a 352개 WebP 정상 확인 후 접힌 목록 지연 생성·단계 표시 및 누적 운 분포 중복 병합을 적용했다. 봉입률 검증은 등급별 평균뿐 아니라 공개 박스 행의 동시 장수와 낱팩 조합, 전체 카드 도달성까지 포함한다. RGB 같은 비숫자 `collector_number`는 실물 번호로 가격을 매칭하고, 현재 상품 상세 표시가를 검색 캐시와 구분한다. 고레어 65장 시세와 운 분포를 갱신했으며 [검토표](m6a-30th-celebration-review.md)에 측정·가정·미검증 범위를 남겼다.
- **2026-09-17 재검토** — M6a 잔여 SAR 3장·AR 2장은 유유테이 원본 500×700을 번호·등급으로 대조해 교체했다. 이미지 교체 후 원본과 256/512를 업로드하고, 예전 기록의 GIF 주소·브라우저 캐시까지 점검한다. 봉입률은 PokéGet 약 720박스 공개 근삿값으로 FUR를 1/6로 갱신하고 운 분포를 다시 생성한다. 정확한 관측 건수가 없는 표본을 임의로 역산하지 않는다.
- **2026-09-16~17** — `m6a-30th-celebration` 추가·RGB 보강. 공식 한국 DB 111장과 일본판 번호 목록 보강 62장, 번호 외 RGB 뮤 3장으로 총 176장을 등록했다. FUR/REPRINT/RGB 등급, 특수 팩 구성, 일본판 단일 120박스 RGB 관측의 잠정값, 참고가·운 분포, R2 원본/256/512 이미지를 동기화한다. 상세 근거와 미확인 사항은 [30주년 검토표](m6a-30th-celebration-review.md)에 보존한다.

- **2026-09-10** — active 94개 상품 12,493장 정체성 감사 및 426장 수정.
  공식 메타·출처/CDN 이미지 대조, 한·일 시세 번호 대응, S/A/PR/ACE 및 RRR 등장 슬롯 복구,
  박스/낱팩 회귀검사와 미검증 보고 절차를 추가했다. 상세는 위 검토 보고서 참조.

- **2026-06-11** — 소드실드 4종(`s6k-jet-black-spirit`, `s5a-matchless-fighters`,
  `s5i-single-strike-master`, `s5r-rapid-strike-master`) 추가.
  - pokemoncard.co.kr 검색 API로 세트명/CDN 폴더/파일 prefix 디스커버리
  - 일본판 보강 시크릿(`external/...`)의 깨진 한글명(`???`)을 fullahead 일본어 카드명 +
    동일 세트 기본 카드 한국어 표기 + 마스크 글자수 교차검증으로 복원
  - `STANDARD_SV_SET_RATES`에 `SWSH_BASE_EXPANSION` 공통 레이트로 등록(운/시뮬 자동 연결)
  - fullahead 일본판 시세 → `jpy_krw × jp_to_kr_factor(0.65)`로 한국판 추정가 산출
  - `build:luck-dist`로 시세 운(가치 운) 분포 `luck_value_ref` 생성
  - 카드 이미지 256/512 WebP variant R2 업로드, 박스 이미지 `{code}.png`로 통일
- **(이전)** `sv9-battle-partners`, `sv7-stellar-miracle`, `sv7a-paradise-dragona` 추가 시
  ACE rarity 인식, ACE SPEC 박스 모델, RR `4 + 10%` 슬롯, 256/512 variant 파이프라인 정립.

## 폴더 / 스크립트 역할

| 경로 | 역할 |
| --- | --- |
| `data/sets/*.json` | 카드/세트 원본 데이터. 직접 수정은 여기부터 한다. |
| `frontend/public/sets/*.json` | Next 앱이 정적으로 fetch하는 세트 데이터 사본. `sync`로 맞춘다. |
| `data/sets-index.json` | 앱에 노출할 active/planned 세트 목록. |
| `data/prices/price-matches.json` | 환율(`jpy_krw`), `jp_to_kr_estimate_factor`, rarity 하한가, 카드별 수동 시세 오버라이드. |
| `frontend/lib/simulation/` | 봉입률 모델과 시뮬레이션 내부 구현. |
| `frontend/lib/simulator.ts` | 컴포넌트가 쓰는 공개 API. `simulateBox`, `simulatePack`만 여기서 보면 된다. |
| `frontend/lib/rarity.ts` | rarity 정렬, 배지, 홀로/히트 판정. |
| `frontend/lib/luck.ts` | 운 점수/기대값/분포. 시세 운은 `luck_value_ref`를 읽는다. |
| `frontend/lib/boxImages.ts` | 세트 코드별 박스 이미지 파일명 매핑. 파일명이 `{code}.png`면 매핑 불필요. |
| `frontend/lib/images.ts` | 카드 이미지 URL 해석. 256/512 variant 경로를 만든다. |
| `frontend/lib/newSets.ts` | 메인/세트선택 화면 `NEW` 뱃지에 노출할 코드·이름. |
| `frontend/app/page.tsx` | 전 세트 import + `sets` 배열(노출 순서). |
| `frontend/components/SetPicker.tsx` | 세트 선택 화면. `SET_THEMES` 그라데이션 + 상단 NEW 배너. |
| `frontend/components/MainScreen.tsx` | 첫 화면 공지 블록. |
| `frontend/public/boxes/` | 박스 이미지 정적 파일. |
| `scripts/discover-set.ts` (`discover`) | pokemoncard.co.kr 검색 API로 세트 폴더/파일 prefix/card_num prefix/번호 범위/shop code 식별. |
| `scripts/fetch-pokemoncard.ts` (`collect`) | pokemoncard.co.kr에서 한국판 카드 메타 수집. |
| `scripts/manual-add.ts` (`manual-add`) | TSV로 누락 카드 수동 보강. |
| `scripts/fetch-jp-images.ts` (`fetch-jp-images`) | 일본판 보강 이미지 수집용 보조 스크립트. |
| `scripts/fetch-fullahead-prices.ts` (`fetch:fullahead-prices`) | fullahead 일본판 시세 → 한국판 추정가 기입. |
| `scripts/import-fullahead-secrets.ts` (`import:fullahead-secrets`) | 한국 DB에 없는 일본판 시크릿을 manifest의 한국 정식명으로 보강하고 이미지·가격·출처를 함께 기입. |
| `scripts/build-luck-distributions.ts` (`build:luck-dist`) | 시세 운 분포 `luck_value_ref`(박스/팩 중앙값·분위수) 생성. |
| `scripts/migrate-to-r2.ts` (`migrate-to-r2`) | 원본 카드 이미지를 R2에 업로드/검증. |
| `scripts/optimize-card-images.ts` (`optimize:images`) | 256/512 WebP variant 생성 및 R2 업로드/검증. |
| `scripts/validate-card-data.ts` (`validate:data`) | 세트 JSON, active index, 이미지 키, rarity 검증. |
| `scripts/validate-luck-model.ts` (`validate:luck`) | 새 세트가 시뮬/운 모델에 명시적으로 연결됐는지 검증. |
| `scripts/validate-value-luck.ts` (`validate:value-luck`) | 시세 운 분포/가치 계산 정합 검증. |
| `scripts/sync-sets.ts` (`sync`) | `data/sets`를 `frontend/public/sets`로 복사. |

> 모든 스크립트는 레포 루트에서 `pnpm --dir scripts <name> -- <args>`로 돌린다.
> 이미지/R2 작업은 `frontend/.env.local`의 `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY`가 필요하다.

한국 공식 DB에 고레어가 뒤늦게 추가된 세트는 `collect -- --set <code> --merge`를 사용한다.
공식 등록 카드는 한국 이름·이미지·메타로 갱신하되 기존 시세 필드는 보존하고, 아직 공식 DB에 없는
일본판 보강 카드(MUR 등)는 삭제하지 않는다. 전체 교체가 필요한 최초 수집에서만 `--merge`를 생략한다.

일본판 폴백의 `card_num`이 가상 ID라 공식 ID와 직접 일치하지 않는 세트는 `--merge-by-number`를
명시한다. 이 옵션은 동일한 세트 내 번호를 공식 카드로 교체하고, 공식 검색에 없는 번호만 그대로
보존한다. 기존 첫 카드 이미지에서 공식 파일 prefix를 추론할 수 없으면 `--asset-prefix M6`처럼
검색 결과의 공식 이미지 prefix도 함께 지정한다. 미러처럼 동일 번호가 여러 장인 세트에는 번호 병합을
쓰지 않는다.

## 전체 작업 순서

0. **디스커버리** — 검색어로 세트를 식별한다(상세는 아래 "디스커버리" 섹션).

   ```powershell
   pnpm --dir scripts discover -- "일격마스터"
   ```

   확보할 것: 정확한 검색어, CDN 폴더 prefix(`wmimages/S/S5/`), 파일 prefix(`S5I`),
   `card_num` prefix(`BS2021001`), fullahead shop code(= 파일 prefix 소문자, `s5i`),
   번호 범위. 자매 세트/프로모 폴더가 섞이면 스크립트가 prefix별로 갈라 보여준다.
1. `data/sets/<code>.json` 스켈레톤 작성. 기존 세트를 복사해 `code`, `name_ko/en/jp`,
   `series`, `type`(expansion/enhanced/hi-class/starter), `release_date`, `box_size`,
   `pack_size`, `*_price_krw`, `rarities`, `box_guarantees`, `pack_slots: []`를 채우고,
   `cards`에는 폴더 prefix를 잡아줄 seed 카드 1장(`image_url`)만 둔다.
   - `rarities`는 길이 내림차순 substring 매칭이라 넉넉한 상위집합으로 둔다(누락 시 rarity=null).
2. 카드 메타 수집:

   ```powershell
   pnpm --dir scripts collect -- --set <code>
   # 검색어가 세트명과 다르면(예: "일격마스터") 오버라이드
   pnpm --dir scripts collect -- --set <code> --search-text "일격마스터"
   # 검색 결과에 재판 상품이 섞이면 카드 번호 prefix로 원본만 제한
   pnpm --dir scripts collect -- --set <code> --card-num-prefix BS2017013
   # 일본판 가상 ID를 쓰던 세트를 한국 공식 번호로 승격할 때 번호 기준 병합
   pnpm --dir scripts collect -- --set <code> --search-text "스톰에메랄다" --asset-prefix M6 --merge --merge-by-number
   # 공식 상세에 레어도 표기가 없는 균일 등급 상품에서만 기본값 사용
   pnpm --dir scripts collect -- --set <code> --default-rarity R
   ```

3. 자동 수집 누락은 TSV로 보강:

   ```powershell
   pnpm --dir scripts manual-add -- --set <code> --tsv data/manual/<code>-additions.tsv
   ```

   한국 공식 DB의 상세 부재는 미수록 근거가 아니다. 대응 일본판 전체 리스트와 `audit:coverage`를 대조해
   빠진 HR/UR이 있으면 한국 정식명 manifest로 보강한다.

   ```powershell
   pnpm --dir scripts import:fullahead-secrets -- --manifest ../data/manual/<manifest>.json
   ```

4. **데이터 검수**: 번호 연속성/누락/null/레어도 분포/이미지 prefix를 확인한다.
   한국 CDN에 없는 시크릿(`external/...`)은 일본판 보강이라 한글명이 `???`로 깨질 수 있다 →
   "일본판 보강 카드 한글명 복원" 섹션으로 처리한다.
5. `data/sets-index.json`의 `active_sets`에 코드 추가.
6. **봉입률 모델 연결**(`frontend/lib/simulation/model.ts`). 공식 봉입률은 비공개이므로
   `box_guarantees._source/_sample_size/_estimated_at`도 같이 남긴다.
   - 갓팩/특수팩은 실제 구성과 `발생 건수 / 전체 표본`이 함께 확인된 경우에만
     `box_guarantees.special_pack_evidence`에 일반 봉입률 표본과 분리해 기록한다.
   - 일반 SV / SWSH 확장팩: `STANDARD_SV_SET_RATES`에 코드 추가(SWSH 공통은 `SWSH_BASE_EXPANSION`).
   - 캐릭터 SR 등 알트아트가 있으면 `ALT_SR_NUMBER_RANGES`에 번호 범위 추가.
   - ACE SPEC 세트: `ACE_SPEC_SET_CODES`에도 추가.
   - MEGA 확장팩: `EXPANSION_MONSTER_WEIGHTS` + `MEGA_MAIN_SR_NUMBER_RANGES`.
   - SV11 특수/하이클래스: `isSv11SpecialSet()` / `hi-class.ts` 전용 분기 확인.
   - `STANDARD_SV_SET_RATES`에 등록하면 `luck.ts`의 `getStandardSvSetRate` 경로로
     **운 모델이 자동 연결**된다(별도 luck 코드 불필요). 특수 분기 세트만 7번을 직접 확인.
7. **운 모델 정합**(특수 분기 세트만). 운은 시뮬 재실행 없이 `luck.ts` 기대값/분포로 계산하므로
   박스 슬롯/고정 슬롯을 바꾸면 다음을 같이 본다: `getLuckRatesForSet()`,
   `subtractBaselineCounts()`, `getBoxScoreDistribution()`, `getPackScoreDistribution()`,
   `getExpectedScoredRarityCounts()`. 박스는 고정 슬롯을 베이스라인으로 차감하고,
   1팩/자판기는 같은 박스 모델 기대값을 `1 / box_size`로 환산한다.
8. **프론트 등록**:
   - `frontend/app/page.tsx` — `import` + `sets` 배열에 추가(노출 순서).
   - `frontend/components/SetPicker.tsx` — `SET_THEMES`에 그라데이션, 필요 시 상단 NEW 배너 날짜.
   - `frontend/lib/newSets.ts` — `NEW_SIM_SET_CODES`/`NEW_SIM_SET_NAMES`를 이번 신상으로 교체.
   - `frontend/components/MainScreen.tsx` — 첫 화면 공지 문구.
   - 박스 이미지: 파일명을 `frontend/public/boxes/<code>.png`로 두면 기본 리졸버가 자동 처리
     (`boxImages.ts` 매핑 불필요). 다른 이름일 때만 `boxImages.ts`에 매핑.
   - 흰 배경 원본은 `frontend/public/boxes/original/<code>.png`에 보존한 뒤 아래 명령으로
      외곽 연결 배경만 제거한다. 출력은 투명 768 PNG와 768 WebP 썸네일이다.
      선택 화면은 고해상도 디스플레이에서 썸네일을 크게 렌더하므로 256px로 낮추지 않는다.

     ```powershell
     pnpm --dir scripts process:box-image -- --input frontend/public/boxes/original/<code>.png --set <code>
     ```
9. **시세 수집**(아래 "시세 + 시세 운" 섹션):

   ```powershell
   pnpm --dir scripts fetch:fullahead-prices -- --set <code> --dry-run
   pnpm --dir scripts fetch:fullahead-prices -- --set <code>
   ```

10. **시세 운(가치 운) 분포 생성** — 반드시 시세 수집 뒤에:

    ```powershell
    pnpm --dir scripts build:luck-dist -- --set <code>
    ```

11. public 동기화:

    ```powershell
    pnpm --dir scripts sync -- --set <code>
    ```

12. 검증:

    ```powershell
    pnpm --dir scripts validate:data -- --set <code> --strict
    pnpm --dir scripts validate:luck -- --set <code> --strict
    pnpm --dir scripts validate:box-guarantees -- --set <code> --trials 1000
    pnpm --dir scripts validate:value-luck -- --set <code>
    ```

    신상 직후 임시 기본 모델을 의도적으로 쓸 땐 `--strict` 없이 돌리고 경고를 PR에 남긴다.
13. 이미지 R2 업로드/검증:

    ```powershell
    pnpm --dir scripts migrate-to-r2 -- --set <code>
    pnpm --dir scripts optimize:images -- --set <code> --sizes "256,512" --concurrency 6
    pnpm --dir scripts optimize:images -- --set <code> --sizes "256,512" --verify-only --concurrency 8
    ```

    `optimize:images`는 일반 카드는 공식 이미지 CDN(`wmimages/...`)에서, 시크릿은
    카드의 `_image_source_url`(일본판 보강 출처)에서 받아 256/512 WebP로 R2에 올린다.
14. 새너티 + 프론트 검증:

    ```powershell
    pnpm --dir frontend exec tsc --noEmit
    pnpm --dir frontend lint
    pnpm --dir frontend build
    ```

    추가로 박스 몬테카를로(예: 3,000박스)를 돌려 박스당 RR/RRR/톱히트 수, 2히트 박스 비율이
    `box_guarantees`와 맞는지 눈으로 확인하면 좋다.
15. 박스 이미지는 직접 넣고(`{code}.png`), 브랜치/PR로 올린다(커밋은 Conventional Commits,
    한국어 설명, AI 흔적 라인 금지). main 직접 push 금지(D-134).

### 기존 팩 혼합 상품 (`type: bundle`)

- 새 카드풀을 복제하지 않고 `bundle_components`에 원본 `set_code`와 `pack_count`만 기록한다.
- 구성별 `simulatePack`을 독립 실행한다. 합친 카드풀로 `simulateBox`를 호출하거나 원본 박스 보장
  슬롯을 적용하지 않는다.
- 서로 다른 팩 장수(예: 일반 5장, 하이클래스 10장)는 각 원본 세트의 `pack_size`를 따른다.
- 상품은 자판기 낱팩 목록에서 제외하고, 힛덱 카드는 원본 세트로 귀속한다.
- 일반 검증에 더해 아래 전용 검증을 실행한다.

  ```powershell
  pnpm --dir scripts validate:bundle -- --set <code> --trials 1000
  ```

## 디스커버리 (pokemoncard.co.kr 검색 API)

`pnpm --dir scripts discover -- "<검색어>"`로 폴더/파일 prefix/card_num prefix/번호 범위/
shop code를 한 번에 뽑는다. 자매 세트나 프로모가 섞이면 prefix별로 갈라 보여주고, 특정
prefix만 보려면 `--prefix S5I`를 붙인다. 아래는 그 스크립트의 내부 동작과 알아둘 함정이다.

엔드포인트는 사이트 JS와 동일하게
`POST https://pokemoncard.co.kr/v2/ajax2_dev2`, `FormData`로
`action=search_text_cards`, `search_text=<검색어>`, `search_params=all`, `limit=<커서>`.
첫 호출 `limit=0`, 응답의 `limit`이 다음 커서, `count=0`이면 종료.

- 결과의 `feature_image`에서 폴더(`wmimages/S/S5/`)와 파일 prefix(`S5I_081`)를, `CardNum`에서
  `BS2021001...` prefix를 얻는다.
- **검색어 함정**: 공식 표기와 검색 인덱스가 다를 수 있다(예: "일격 마스터"는 0건, "일격마스터"는 매칭).
  `collect`에는 `--search-text`로 검증된 검색어를 넘긴다.
- **폴더 공유**: 자매 세트가 폴더를 공유한다(`S5I`/`S5R` 둘 다 `wmimages/S/S5/`,
  `S6K`/`S6H` 둘 다 `wmimages/S/S6/`). `collect`의 폴더 필터는 같지만 세트명 검색이
  분리해 주므로, 수집 후 파일 prefix(`S5I_` vs `S5R_`)로 교차오염이 없는지 확인한다.
- fullahead shop code = 파일 prefix 소문자(`S5I` → `s5i`). 시세 수집은 카드 `image_url`의
  파일 prefix에서 자동 추출한다.

## 일본판 보강 카드 한글명 복원 (`???` 처리)

한국 CDN에 없는 시크릿(SR/HR/UR)은 일본판 보강(`external/...`)으로 들어오는데, 한글명이
`??? VMAX`처럼 깨져 들어올 수 있다. `?`는 **글자 수가 보존**되므로 다음으로 정확히 복원한다.

1. fullahead 카드 타이틀에서 일본어 카드명 + 번호 + 레어도를 얻는다
   (`span.itemName`의 `PK-<SHOP>-<번호> <이름> <레어도>`). 번호/레어도 식별은 Bulbapedia 같은
   세트 리스트로 교차확인할 수 있지만, 최종 `name_ko`는 반드시 한국 공식 카드명으로만 저장한다.
2. 일본어→한국어 매핑은 **같은 세트 기본 카드**에서 가져온다. V/VMAX 시크릿은 같은 포켓몬의
   기본 V(RR)·VMAX(RRR) 카드가 한국어 표기를 갖고 있고, 번호가 정렬돼 있어 바로 짝지어진다.
   골드(UR)·트레이너는 세트 내 일반 카드(C/U)의 한국어 표기를 우선 쓴다. 같은 세트에 기본 카드가
   없으면 `pokemoncard.co.kr` 또는 이미 수집된 다른 한국판 세트의 동일 카드명으로 보강한다.
3. 마스크된 `?`의 글자 수/띄어쓰기 패턴으로 후보를 교차검증한다
   (예: `?? ???? VMAX` = 2글자+4글자 → "일격 우라오스 VMAX").
4. `name_ko`와 함께 `card_type`(포켓몬/트레이너/에너지)도 채운다. 이후 `sync` + `build:luck-dist`
   재실행(카드 타입이 히트 판정/가치에 영향).
5. 커밋 전 `rg -n "\?\?\?|name_ko.*\?" data/sets/<code>.json frontend/public/sets/<code>.json`으로
   잔여 `???`/깨진 한글명이 없는지 확인한다. 일본어 이름이나 마스크 문자열을 `name_ko`에 남기지 않는다.

> 보강 출처에 따라 `name_ko`가 일본어/깨짐일 수 있으니, 시크릿은 항상 4번 검수에서 눈으로 본다.

## 시세 + 시세 운(가치 운) 파이프라인

한국판 공식 시세 데이터가 없으므로 **일본판 시세에 한국 보정계수를 곱한 추정치**를 쓴다.

- `fetch:fullahead-prices -- --set <code>`
  - shop code는 카드 `image_url` 파일 prefix에서 자동 추출(`S6K` → `s6k`).
  - `price_ref_krw = round(priceJpy × jpy_krw × jp_to_kr_factor)`.
    기본값은 `data/prices/price-matches.json`(`jpy_krw=9.5`, `jp_to_kr_estimate_factor=0.65`),
    환경변수 `PRICE_JPY_KRW`/`PRICE_JP_TO_KR_FACTOR`로 오버라이드.
  - 레어도 하한가(`rarity_floor_krw`: AR 1000 / SR 2000 / SAR 5000), 최소 표시가
    `min_price_ref_krw=1000` 미만은 스킵(`--include-low`로 해제).
  - 카드 단위 수동 시세는 `price-matches.json`의 `cards.<card_num>`로 고정(일본판 번호 부재 등).
  - C/U/R/RR/RRR은 기본 제외(고레어만). 결과는 `data/sets` + `frontend/public/sets` 둘 다 기입.
  - `price_source`에 fullahead URL + `jp_to_kr_factor`를 박아 출처를 남긴다(D-034).
  - 플래그: `--dry-run`, `--force`(기존 source 덮어쓰기), `--include-low`, `--all`(planned 포함).
  - 이미 `price_confidence: "source"`가 들어간 세트를 다시 갱신할 때는 반드시 `--force`를 붙인다.
    fullahead 가격은 변하고, 기존 source 값은 기본 동작으로 덮어쓰지 않는다.
  - 가격 갱신 후 상위 힛카드와 저가 트레이너 SR을 눈으로 확인한다. 특히 `마리`, `풍란`, `릴리에`,
    `카틀레야`, `클라라`처럼 인기 캐릭터 SR/SAR가 3,000원대 floor 값이면 번호-이름 매칭이 밀렸을 수 있다.
  - fullahead 타이틀의 `PK-<SHOP>-<번호> <일본어 이름> <레어도>`와 로컬 `number/name_ko`가 같은 카드인지
    확인한다. 가격은 번호로 붙기 때문에, 카드 이름이 한 칸만 밀려도 고가 카드 가격이 전혀 다른 카드에 붙는다.
- `build:luck-dist -- --set <code>`
  - 박스 20,000회 / 팩 40,000회 시뮬로 "전형적(중앙값) 박스/팩 가치"를 구해
    `luck_value_ref`(box/pack median + 분위수)를 세트 JSON에 박는다.
  - **반드시 시세 수집 뒤**에, 그리고 가격이나 `card_type`(히트 판정)을 바꾸면 다시 돌린다.
  - 시세 운은 시뮬을 다시 돌리지 않고 이 분위수로 observed/expected 등급을 매긴다.

### 가격 갱신 후 sanity check

최근 추가 세트나 가격 재수집 PR은 아래를 통과해야 한다.

```powershell
pnpm --dir scripts fetch:fullahead-prices -- --set <code> --force
pnpm --dir scripts build:luck-dist -- --set <code>
pnpm --dir scripts validate:box-guarantees -- --set <code> --trials 1000
pnpm --dir scripts validate:value-luck -- --set <code>
```

- `matched`가 고레어 수와 맞고 `unmatched_high=0`인지 확인한다.
- `source_prices`가 0이 아니고 `expected_box_value`가 비정상적으로 낮지 않은지 확인한다.
- 상위 가격 10장과 `SR` 트레이너 중 3,000원 이하 카드를 출력해 이름/번호/가격을 본다.
- 이름이나 `card_type`을 고치면 public 세트 JSON까지 동기화하고 `build:luck-dist`를 다시 돌린다.

## 봉입률 기록 원칙

- 고전팩은 일본 **재판 근거 우선**. 재판 수치를 확보하지 못하면 발매 당시 자료나 인접 세트의 공개 추정치를 사용할 수 있다(2026-09-08 사용자 결정). 완전 동일한 실측은 필수 아님. 초판 폴백·판본 불명·범위 근사·차용한 항목을 구분하고, 미확인 표본은 `null`로 남긴다.
- 썬&문 검토 근거는 [세트별 검토표](sm-pull-rate-review.md)와 `scripts/review-sm-pull-rates.ts`에 관리한다. 모델 변경 뒤 `pnpm --dir scripts review:sm-rates -- --write`로 출처·규칙·모델 스냅샷을 반영하고 `--check`로 일치 여부를 확인한다. 숫자가 바뀐 세트는 가치 운 분포 재생성 및 공개 JSON 동기화까지 수행한다. 이 검사는 코드 정합성 검사이지 실물 봉입률 실측 검증이 아니다.

- 한국판 공식 봉입률은 비공개다.
- `box_guarantees`는 표시용 메타이고, 실제 시뮬 모델은
  `frontend/lib/simulation/model.ts`와 `expansion.ts`가 사용한다.
- `SR 1장 확정`이라고 쓰지 않는다. 일반 SV/SWSH는 `SR/HR/UR 중 1장`,
  MEGA는 `비서포트 트레이너즈 SR 1장 + SR/SAR/MUR 중 1장`,
  블랙볼트/화이트플레어는 `SR 1장 + SAR/BWR 선택 슬롯`처럼 슬롯 단위로 기록한다.
- RR처럼 박스 내 장수 범위가 확인된 슬롯은 평균 가중치가 아니라 명시 슬롯으로 구현한다.
- 공식 카드목록에서 ACE SPEC 문구가 있는 카드는 rarity를 `ACE`로 수동 확인한다.
  자동 수집이 `C`로 가져올 수 있다.
- 미러/마스터볼 미러처럼 별도 카드 변형이 필요한 슬롯은 미구현 상태를
  `box_guarantees._source`나 문서에 명시한다.
- 출처, 표본 수, 추정일을 같이 남긴다.

## 자주 나는 실수

### 이름·등급·이미지 완료 기준 (2026-09-08 보강)

- 파일 존재/HTTP 200/256·512 너비 검사만으로 완료 처리하지 않는다. 공식 이름과 실제 인쇄 번호,
  일본판 번호·등급·일러스트를 함께 대조하고 고레어 전체를 이미지 시트로 육안 검수한다.
- 일본어를 임의 번역하지 않는다. 보강 manifest에 `name_jp`, `name_source_card_num`,
  `rarity_source`, `image_source_url`을 남긴다. 한국 공식 DB의 동일 카드명을 사용한다.
  예: `소원의 바통`, `동굴탈출로프`, `레스큐탱크`; SM3+ #082는 `뮤츠 GX`이며 `빛나는`을 붙이지 않는다.
- 한국판 번호와 일본판 번호가 다르면 `_jp_number`를 별도 보존한다. THE BEST OF XY의
  한국 181/182/183/184/185는 일본 182/184/185/181/183이다. 가격·일러스트를 같은 번호로 붙이지 않는다.
- SM3+의 한국 공식 자산 ID 061/062는 실제 카드 인쇄 번호 062/061이다. 파일명보다 인쇄 번호를 우선한다.
- HR을 UR로 바꾸지 않는다. THE BEST OF XY의 SR/UR은 일본 샵의 `SR仕様`/`UR仕様` 분류이고,
  SM3+ #082의 H는 별표 시크릿 분류다. 카드에 해당 영문 등급이 인쇄됐다고 설명하지 않는다.
- 상세 모달은 R2 원본을 우선 표시하고 실패할 때 512 WebP로 폴백한다. 목록/개봉용 256·512도
  별도 생성한다. 작은 소스를 512로 확대했다고 고해상도 원본을 확보한 것으로 보고하지 않는다.
- 박스는 해당 한국 제품의 **닫힌 한 박스**를 사용한다. 팩/여러 상자/일본판/펼친 진열상자를 혼용하지 않는다.
  `boxes/original/`에 출처 원본을 보존하고 PNG·WebP를 가공한 뒤 실제 결과를 육안 확인한다.
- 이 6세트는 `pnpm --dir scripts audit:legacy-sources`로 공식 정보 496장과 고레어 85장의
  검수 manifest를 대조한다. 근거는 `data/manual/sm-legacy-reviewed-cards.json`.
- FullAhead에서 세트를 찾지 못할 경우, 검증한 yuyu-tei 판매 표시 가격을 `price-matches.json`의
  `manual_jpy`로 기록하고 `fetch:prices` → `build:luck-dist`를 실행할 수 있다.
  품절 상품의 표시 가격도 참고 호가일 뿐 실제 거래가/한국판 실거래가가 아님을 남긴다.

- `data/sets`만 고치고 `frontend/public/sets`를 동기화하지 않음
- `page.tsx`/`SetPicker`/`newSets`에 등록을 빠뜨려 화면에 안 뜸
- `ACE` 같은 새 rarity를 `rarity.ts`나 `validate-card-data.ts`에 추가하지 않음
- 새 세트를 `STANDARD_SV_SET_RATES`/`EXPANSION_MONSTER_WEIGHTS`에만 넣고
  `luck.ts`의 기대값/베이스라인/분포(특수 분기)를 확인하지 않음
- 박스 모델만 맞추고 `getPackScoreDistribution()`을 빼먹어서 자판기 운이 틀어짐
- 시세를 수집하고 `build:luck-dist`를 안 돌려 `luck_value_ref`가 비거나 옛값으로 남음
- `card_type`을 고친 뒤 `build:luck-dist`를 다시 안 돌림
- 이미지 원본은 있는데 `cards/256`, `cards/512` variant가 없어 로컬에서 이름만 보임
- 일본판 보강 시크릿의 `???`/일본어 `name_ko`를 그대로 둠
- fullahead 가격을 갱신하면서 `--force`를 빼먹어 옛 `source` 가격이 그대로 남음
- fullahead 번호와 로컬 카드명이 밀린 상태로 가격을 붙여 인기 트레이너 SR/SAR가 3,000원대가 됨
- 평균 RR 수만 맞추고 박스당 RR 최대치를 제한하지 않음
- 한국판 공식 확률처럼 보이는 문구를 사용함

## 신규 rarity 발견 시 (D-150)

자동 수집 스크립트는 영문/숫자 토큰 경계로 등급을 매칭한다(과거 `includes` 방식은 폐기).
새 등급이 기존 등급에 흡수되는 사일런트 손실을 막으려면 **데이터를 다시 받기 전에** 다음을
한 번에 갱신한다.

1. **세트 JSON**: `data/sets/<code>.json`의 `rarities` 배열에 새 등급 추가.
2. **검증**: `scripts/validate-card-data.ts`의 `KNOWN_RARITIES`·`HIGH_RARITIES`.
3. **표시**: `frontend/lib/rarity.ts`의 `RARITY_ORDER`·`DISPLAY_RARITY_ORDER`·`FILTER_RARITY_ORDER`
   ·`HIT_RARITY_ORDER`·`RARITY_BADGE`·`CARD_GLOW`·`RARITY_TEXT_COLOR`·`RARITY_TIER`
   ·`RARITY_FULL_LABEL`·`RARE_RARITIES`·`HIT_RARITIES`·`HOLO_RARITIES`.
4. **풀**: `frontend/lib/simulation/pools.ts`의 `RarityPools` 인터페이스와 `getRarityPools()`에
   `<r>All` / 필요 시 `<r>Pokemon` / `<r>Trainer` 풀 추가.
5. **시뮬 모델**: 박스 슬롯에 등장한다면 `model.ts` (가중치 상수) + `hi-class.ts` / `expansion.ts`
   (슬롯 분기)에서 별도 슬롯으로 처리. 기존 슬롯에 흡수되면 사일런트 손실이 다시 발생한다.
6. **럭 점수**: `frontend/lib/luck.ts` `getLuckRatesForSet`에서 SAR/UR top 가중 갱신.
7. **재수집**: `pnpm --dir scripts collect -- --set <code>`. 이때 rarity 배열에 새 등급이
   포함돼 있어야 fetch가 SR이 아닌 SSR로 정확히 매칭한다.
8. **검증**: `pnpm --dir scripts validate:data -- --set <code> --strict`.

사례: 2026-05 sv4a 샤이니트레저 ex의 `SSR` (Shiny Super Rare).
"SSR".includes("SR") → 기존 SR 풀에 18장이 흡수되던 문제를 위 절차로 분리.
