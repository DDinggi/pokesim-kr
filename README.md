# PokéSim KR

한국 포켓몬 TCG 박스깡 / 자판기깡 시뮬레이터.

자세한 설계·결정 기록은 [AGENTS.md](./AGENTS.md) 참고.

---

## 기능

### 박스깡

- 30팩 박스를 통째로 깡. SR · SAR · UR 보장 슬롯 포함.
- 자동(한 팩씩 펼쳐지는 연출) / 즉시(전체 결과 한 번에) 모드.
- 세트별 봉입률 · 보장 슬롯 룰 적용(MEGA / SV 시리즈).

### 자판기깡

- 자판기 UI에서 1~10팩만 골라서 깡.
- 박스보다 가벼운 시뮬, 모바일 친화적.

### 공통

- 카드 클릭 → 모달 + 등급별 홀로그래픽 효과(CSS + mousemove 직접 구현).
- 세션 누적(localStorage) — 새로고침해도 결과 유지, 메인 화면에서 통계 + 카드 목록 확인.
- 글로벌 통계 — 누적 시뮬 횟수 · 박스 · 팩 · 사용 금액.
- 모든 봉입률에 출처 · 표본 · "공식 비공개" 안내 명시.

## 지원 세트 (18종)

### MEGA

- MEGA 확장팩 「닌자스피너」
- MEGA 확장팩 「니힐제로」
- MEGA 하이클래스팩 「MEGA 드림 ex」
- MEGA 확장팩 「인페르노X」
- MEGA 확장팩 「메가브레이브」
- MEGA 확장팩 「메가심포니아」

### 스칼렛&바이올렛

- 스칼렛&바이올렛 확장팩 「블랙볼트」
- 스칼렛&바이올렛 확장팩 「화이트플레어」
- 스칼렛&바이올렛 확장팩 「로켓단의 영광」
- 스칼렛&바이올렛 강화 확장팩 「열풍의 아레나」
- 스칼렛&바이올렛 확장팩 「배틀파트너즈」
- 스칼렛&바이올렛 하이클래스팩 「테라스탈 페스타 ex」
- 스칼렛&바이올렛 확장팩 「초전브레이커」
- 스칼렛&바이올렛 강화 확장팩 「낙원드래고나」
- 스칼렛&바이올렛 확장팩 「스텔라미라클」
- 스칼렛&바이올렛 확장팩 「변환의 가면」
- 스칼렛&바이올렛 강화 확장팩 「포켓몬 카드 151」
- 스칼렛&바이올렛 강화 확장팩 「트리플렛비트」

---

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프론트엔드 | Next.js 15(App Router) + TypeScript + Tailwind 4 |
| 배포 | Cloudflare Workers(OpenNext for Cloudflare) |
| DB | Supabase(sim_events 추적 + 글로벌 통계 RPC) |
| 데이터 수집 | tsx 스크립트(pokemoncard.co.kr / yuyu-tei / PokeGuardian) |
| 이미지 | Cloudflare R2 + WebP variant CDN |

---

## 로컬 개발

```bash
# Node 22 LTS + pnpm 필요
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

기본 개발 서버: `http://localhost:3000`

## 데이터 갱신

```bash
cd scripts
pnpm collect -- --set <code>          # pokemoncard.co.kr 자동 수집
pnpm fetch-jp-images -- --set <code>  # 일본판 이미지 보강
pnpm sync                             # data/sets -> frontend/public/sets
```

이미지 CDN 갱신:

```bash
pnpm migrate-to-r2 -- --set <code>
pnpm optimize:images -- --set <code> --sizes "256,512"
```

---

## 폴더 구조

```txt
.
├── AGENTS.md             # 설계 결정 SSOT
├── frontend/             # Next.js 앱
├── data/sets/            # 카드 원천 JSON
├── scripts/              # 데이터 수집 / sync / 이미지 처리
├── supabase/migrations/  # DB 스키마(RPC + RLS)
└── docs/                 # 운영 문서와 구조 설명
```

---

## 향후 고민

- **다른 팩들 추가** — 미지원 한국 공식 발매 세트와 신상 팩을 빠르게 추가할 수 있도록 데이터 수집·검증·이미지 업로드 파이프라인을 계속 정리.
- **위시리스트 카드** — 마음에 드는 카드나 목표 카드를 저장하고, 시뮬 결과에서 위시리스트 적중 여부를 보여주는 기능. 우선은 가벼운 로컬 저장 방식부터 검토.
- **카드 그레이딩 측정 보조** — 사용자가 올린 카드 사진으로 센터링/컨디션 체크를 돕는 기능. PSA/BGS 같은 정식 등급 예측이 아니라, 사용자가 상태를 가늠하는 참고 도구 수준으로 검토.

도입 여부는 MVP 사용자 반응 + 데이터 수집 가능성 확인 후 결정.

---

## 데이터 정책

> "정확한 확률" 대신 "가장 투명한 추정치".

포켓몬 한국판 공식 봉입률은 비공개입니다. 표시되는 모든 확률은 커뮤니티 추정 기반이며, 항상 출처 · 표본 크기 · 공식 비공개 안내를 함께 노출합니다.

---

## 라이선스

비영리 팬 프로젝트(Non-commercial fan project). Pokémon, 포켓몬 카드 게임, 모든 카드 일러스트의 권리는 The Pokémon Company / Nintendo / Game Freak / Creatures Inc.에 있습니다.

---

## 연락

pokesimkr@gmail.com
