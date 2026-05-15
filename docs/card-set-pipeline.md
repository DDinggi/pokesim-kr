# Card Set Pipeline

이 문서는 새 카드 세트를 추가할 때의 작업 순서를 고정하기 위한 운영 노트다.
카드 메타의 SSOT는 `data/sets/*.json`이고, 앱에서 읽는 사본은
`frontend/public/sets/*.json`이다.

## 이번 변경 요약

- `sv9-battle-partners`, `sv7-stellar-miracle`, `sv7a-paradise-dragona` 세트 추가
- 세트 선택, 박스깡, 자판기깡에서 세 세트가 노출되도록 연결
- 박스 이미지 매핑 추가: `partners.png`, `miracle.png`, `dragona.png`
- `ACE` rarity를 UI/검증/시뮬에서 인식하도록 추가
- 스텔라미라클/낙원드래고나는 ACE SPEC 1장 박스 모델 적용
- 세 세트의 RR은 박스 기준 `4장 + 10% 확률로 1장 추가`로 고정
- 카드 이미지 256/512 WebP variant를 R2에 업로드 및 검증
- `optimize-card-images.ts`는 `wmimages/...` 원본을 공식 이미지 CDN에서 받아 R2 variant만 업로드하도록 수정

## 폴더 역할

| 경로 | 역할 |
| --- | --- |
| `data/sets/*.json` | 카드/세트 원본 데이터. 직접 수정은 여기부터 한다. |
| `frontend/public/sets/*.json` | Next 앱이 정적으로 fetch하는 세트 데이터 사본. `sync`로 맞춘다. |
| `data/sets-index.json` | 앱에 노출할 active/planned 세트 목록. |
| `frontend/lib/simulation/` | 봉입률 모델과 시뮬레이션 내부 구현. |
| `frontend/lib/simulator.ts` | 컴포넌트가 쓰는 공개 API. `simulateBox`, `simulatePack`만 여기서 보면 된다. |
| `frontend/lib/rarity.ts` | rarity 정렬, 배지, 홀로/히트 판정. |
| `frontend/lib/boxImages.ts` | 세트 코드별 박스 이미지 파일명 매핑. |
| `frontend/lib/images.ts` | 카드 이미지 URL 해석. 256/512 variant 경로를 만든다. |
| `frontend/public/boxes/` | 박스 이미지 정적 파일. |
| `scripts/fetch-pokemoncard.ts` | pokemoncard.co.kr에서 한국판 카드 메타 수집. |
| `scripts/manual-add.ts` | TSV로 누락 카드 수동 보강. |
| `scripts/fetch-jp-images.ts` | 일본판 보강 이미지 수집용 보조 스크립트. |
| `scripts/migrate-to-r2.ts` | 원본 카드 이미지를 R2에 업로드/검증. |
| `scripts/optimize-card-images.ts` | 256/512 WebP variant 생성 및 R2 업로드/검증. |
| `scripts/validate-card-data.ts` | 세트 JSON, active index, 이미지 키, rarity 검증. |
| `scripts/sync-sets.ts` | `data/sets`를 `frontend/public/sets`로 복사. |

## 새 세트 추가 순서

1. `data/sets/<set-code>.json`을 만든다.
   기존 세트를 복사해서 `code`, `name_ko`, `series`, `type`,
   `release_date`, `box_size`, `pack_size`, `price`, `rarities`,
   `box_guarantees`를 먼저 채운다.

2. 한국 공식 제품/카드 페이지 기준으로 카드 메타를 수집한다.

```powershell
pnpm --dir scripts collect -- --set <set-code>
```

3. 자동 수집 누락이 있으면 TSV로 보강한다.

```powershell
pnpm --dir scripts manual-add -- --set <set-code> --tsv data/manual/<set-code>-additions.tsv
```

4. `data/sets-index.json`의 `active_sets`에 세트 코드를 추가한다.

5. 박스 이미지가 있으면 `frontend/public/boxes/`에 넣고
   `frontend/lib/boxImages.ts`에 매핑한다.

6. 봉입률 모델이 기존 일반 확장팩과 다르면 `frontend/lib/simulation/model.ts`에
   세트별 모델을 추가한다. 공식 봉입률은 비공개이므로 `box_guarantees._source`,
   `_sample_size`, `_estimated_at`도 함께 남긴다.

7. public 세트 JSON을 동기화한다.

```powershell
pnpm --dir scripts sync -- --set <set-code>
```

8. 데이터 검증을 돌린다.

```powershell
pnpm --dir scripts validate:data -- --set <set-code> --strict
```

9. 원본 이미지를 R2에 올리고 검증한다.

```powershell
pnpm --dir scripts migrate-to-r2 -- --set <set-code>
pnpm --dir scripts migrate-to-r2 -- --set <set-code> --verify-only --concurrency 8
```

10. 256/512 WebP variant를 만들고 검증한다.

```powershell
pnpm --dir scripts optimize:images -- --set <set-code> --sizes "256,512" --concurrency 4
pnpm --dir scripts optimize:images -- --set <set-code> --sizes "256,512" --verify-only --concurrency 8
```

11. 프론트 검증을 돌린다.

```powershell
pnpm --dir frontend lint
pnpm --dir frontend build
```

## 봉입률 기록 원칙

- 한국판 공식 봉입률은 비공개다.
- `box_guarantees`는 표시용 메타이고, 실제 시뮬 모델은
  `frontend/lib/simulation/model.ts`와 `expansion.ts`가 사용한다.
- `SR 1장 확정`이라고 쓰지 않는다. 일반 SV는 `SR/SAR/UR 중 1장`,
  MEGA는 `비서포트 트레이너즈 SR 1장 + SR/SAR/MUR 중 1장`,
  블랙볼트/화이트플레어는 `SR 1장 + SAR/BWR 선택 슬롯`처럼 슬롯 단위로 기록한다.
- RR처럼 박스 내 장수 범위가 확인된 슬롯은 평균 가중치가 아니라 명시 슬롯으로 구현한다.
- 공식 카드목록에서 ACE SPEC 문구가 있는 카드는 rarity를 `ACE`로 수동 확인한다.
  자동 수집이 `C`로 가져올 수 있다.
- 미러/마스터볼 미러처럼 별도 카드 변형이 필요한 슬롯은 미구현 상태를
  `box_guarantees._source`나 문서에 명시한다.
- 출처, 표본 수, 추정일을 같이 남긴다.

## 자주 나는 실수

- `data/sets`만 고치고 `frontend/public/sets`를 동기화하지 않음
- `ACE` 같은 새 rarity를 `rarity.ts`나 `validate-card-data.ts`에 추가하지 않음
- 이미지 원본은 있는데 `cards/256`, `cards/512` variant가 없어 로컬에서 이름만 보임
- 평균 RR 수만 맞추고 박스당 RR 최대치를 제한하지 않음
- MEGA의 비서포트 트레이너즈 SR 확정 슬롯과 포켓몬/서포트 SR 슬롯을 섞어 버림
- ACE SPEC 카드를 일반 C/U로 둬서 박스 ACE 슬롯이 비어 버림
- 한국판 공식 확률처럼 보이는 문구를 사용함

## 신규 rarity 발견 시 (D-150)

자동 수집 스크립트는 `rarityRaw.includes(r)` substring 매칭을 길이 내림차순으로 시도한다.
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
