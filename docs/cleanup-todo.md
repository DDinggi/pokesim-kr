# Cleanup TODO

이 문서는 이미지 CDN 이전, 스테이징/벤치마크, 카드 데이터 보강 중 남은 일을 한곳에 모은다.

## P0: 데이터 정합성

- `m-black-volt`, `m4-black-bolt`, `m5-black-bolt`, `s4-black-volt`는 placeholder다. `sets-index.active_sets`에 넣기 전 실제 카드 데이터를 수집한다.
- `sv9-battle-partners`는 planned/hidden 상태다. 고레어 수집이 끝나기 전에는 UI에 노출하지 않는다.

검증 명령:

```bash
cd scripts
pnpm validate:data
pnpm validate:data -- --set m-inferno-x
```

## P1: 이미지 로딩 속도

- 현재 R2/CDN 이전은 핫링킹/비용 리스크를 줄였지만 원본 바이트가 그대로라 속도 개선은 확인되지 않았다.
- `sharp` 기반 변환 파이프라인을 사용한다.
  - `cards/256/{key}.webp`: 박스/팩/목록용
  - `cards/512/{key}.webp`: 모달/상세용
  - 원본은 기존 R2 key 그대로 보관
- 프론트는 카드 타일 크기에 맞춰 256/512 WebP를 요청한다.
- 변환 후 같은 벤치마크로 `bytes`, `median`, `p75`를 다시 기록한다.

```bash
cd scripts
pnpm optimize:images -- --set m4-ninja-spinner --dry-run
pnpm optimize:images -- --set m4-ninja-spinner
pnpm optimize:images -- --set m4-ninja-spinner --verify-only
pnpm benchmark:images -- --set m4-ninja-spinner --samples 24 --runs 5 --new-size 256
```

상태:

- 전체 2,538장 대상 256/512 WebP 변형은 R2 업로드 및 공개 CDN 검증 완료.
- 검증 결과: `verified=5076`, `missing=0`, `failed=0`.
- 남은 일: production/staging 환경변수 `NEXT_PUBLIC_CARD_IMAGE_VARIANTS=1` 전환 후 배포 검증.

## P1: 배포/벤치마크

- Windows 한글 경로에서 OpenNext 빌드가 실패한다. staging 배포는 WSL 또는 Linux CI에서 수행한다.
- staging URL 확보 후 같은 스크립트로 production/staging을 비교한다.

```bash
cd scripts
pnpm benchmark:images -- --prod-site https://pokesim.kr --staging-site https://<staging-url> --samples 24 --runs 5
```

## P2: 코드 정리

- 레어도 표시/정렬/히트 계산은 `frontend/lib/rarity.ts`를 SSOT로 사용한다.
- 이미지 URL 변환은 `frontend/lib/images.ts`만 사용한다.
- R2 이전은 `scripts/migrate-to-r2.ts`, 데이터 검증은 `scripts/validate-card-data.ts`, 벤치마크는 `scripts/benchmark-image-delivery.ts`로 역할을 분리한다.
- 생성물인 `.next`, `.open-next`, 루트 임시 `package.json`/`pnpm-lock.yaml`은 커밋하지 않는다.

## P2: 표시 정책

- 데이터 rarity는 MEGA의 MUR도 `UR`로 저장한다.
- UI 표시는 MEGA 컨텍스트일 때만 `UR`을 `MUR`로 보여준다.
- SV 계열 `UR`은 그대로 `UR`로 보여준다.
- BWR은 `sv11a-white-flare`, `sv11b-black-bolt` 각각 1장이어야 한다.
- 하이클래스팩의 `rarity: null`은 일반/병렬 베이스 풀로 허용한다. 레어도를 임의 추정해 채우지 않는다.

## Done

- `m-inferno-x` 누락 MUR 보강: `메가리자몽X ex` M2 `116/080`을 `UR`로 정규화해 추가했고, 이미지는 R2 `external/m-inferno-x/BS2025014116.jpg`로 업로드했다.
- `sv9a-blazing-arena`에서 SV-P 프로모 164~171 8장을 제거하고 `sv-p-promo.json`으로 분리했다.
- `m-dream-ex`, `sv8a-terastal-festa`의 `rarity: null`은 하이클래스 베이스 풀로 보고 검증 경고 대상에서 제외했다.
- 이미지 최적화 완료: 전체 2,538장 기준 256/512 WebP 5,076개 CDN 검증 완료. 대표 벤치마크는 256 WebP 기준 median 94~95.5% 개선.
