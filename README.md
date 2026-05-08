# PokéSim KR

한국 포켓몬 TCG **박스깡 / 자판기깡 시뮬레이터**.

> 자세한 설계·결정 기록은 [`AGENTS.md`](./AGENTS.md) 참고.

---

## 기능

### 박스깡
- 30팩 박스를 통째로 깡. SR · SAR 보장 슬롯 포함.
- **자동** (한 팩씩 펼쳐지는 연출) / **즉시** (전체 결과 한 번에) 두 가지 모드.
- 세트별 봉입률 · 보장 슬롯 룰 적용 (MEGA / SV 시리즈).

### 자판기깡
- 자판기 UI에서 1~10팩만 골라서 깡.
- 박스보다 가벼운 시뮬, 모바일 친화적.

### 공통
- 카드 클릭 → 모달 + 등급별 **홀로그래픽 효과** (라이브러리 없이 CSS + mousemove로 직접 구현).
- 세션 누적 (localStorage) — 새로고침해도 결과 유지, 메인 화면에서 통계 + 카드 목록 확인.
- 글로벌 통계 — 누적 시뮬 횟수 · 박스 · 팩 · 사용 금액.
- **모든 봉입률에 출처 · 표본 · "공식 비공개" 안내** 명시.

### 지원 세트 (16종)
- **MEGA**: 닌자 스피너, 고룡의 무, 환상의 ex, 인페르노 X, 메가 브레이브, 메가 심포니아
- **SV**: 블랙 볼트, 화이트 플레어, 영광의 빛, 분투의 연무장, 배틀 파트너즈, 테라스탈 페스타, 슈퍼 일렉트릭, 변환의 가면, 151, 트리플렛 비트

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router) + TypeScript + Tailwind 4 |
| 배포 | Cloudflare Workers (OpenNext for Cloudflare) |
| DB | Supabase (sim_events 추적 + 글로벌 통계 RPC) |
| 데이터 수집 | tsx 스크립트 (pokemoncard.co.kr / yuyu-tei / PokeGuardian) |

---

## 로컬 개발

```bash
# Node 22 LTS + pnpm 필요
cd frontend
pnpm install
cp .env.example .env.local   # Supabase 키 입력
pnpm dev                     # http://localhost:3000
```

### 데이터 갱신

```bash
cd scripts
pnpm collect -- --set <code>          # pokemoncard.co.kr 자동 수집
pnpm fetch-jp-images -- --set <code>  # 일본판 이미지 보강
pnpm sync                             # data/sets → frontend/public/sets
```

---

## 폴더 구조

```
.
├── AGENTS.md             # 설계 결정 SSOT
├── frontend/             # Next.js 앱
├── data/sets/            # 카드 원천 JSON
├── scripts/              # 데이터 수집 / sync
├── supabase/migrations/  # DB 스키마 (RPC + RLS)
└── docs/
```

---

## 향후 고민

- **실제 포켓몬 자판기 현황 연동** — 한국 내 실물 포켓몬 카드 자판기 위치 / 재고를 지도/리스트로 보여줄지. 자판기깡 모드와 자연스럽게 이어지는 기능. 데이터 수집 / 갱신 비용이 핵심 관건.
- **카드 간단 그레이딩** — 사용자가 자기 카드를 등록하면 상태(컨디션) 자가진단 + 추정 시세를 보여주는 기능. PSA / BGS 같은 정식 그레이딩이 아니라 가벼운 가이드 수준. 시세 데이터 출처 신뢰도가 관건.

도입 여부는 MVP 사용자 반응 + 데이터 수집 가능성 확인 후 결정.

---

## 데이터 정책

> "정확한 확률" 대신 **"가장 투명한 추정치"**.

포켓몬 한국판 공식 봉입률은 비공개입니다. 표시되는 모든 확률은 커뮤니티 추정 기반이며, 항상 **출처 · 표본 크기 · 공식 비공개** 안내를 함께 노출합니다.

---

## 라이선스

비영리 팬 프로젝트 (Non-commercial fan project). Pokémon, 포켓몬 카드 게임, 모든 카드 일러스트의 권리는 The Pokémon Company / Nintendo / Game Freak / Creatures Inc.에 있습니다.

---

## 연락

whaudrl1234@gmail.com
