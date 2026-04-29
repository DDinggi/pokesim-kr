# PokéSim KR

한국 포켓몬 TCG **박스깡(30팩)** 시뮬레이터 + 럭 점수 / 카드 리뷰 공유 웹 서비스.

> **상태:** 개발 중 — D1 인프라 셋업 단계 (2026-04-29 시작)
>
> **단일 진실 원천:** 모든 결정과 구현은 [`AGENTS.md`](./AGENTS.md)를 따릅니다.

---

## 한 줄 정의

영문판 시뮬레이터([pokemonsim.com](https://pokemonsim.com))가 다루지 않는 **한국판 카드 + 박스 단위 + 한국 사용자 패턴**에 집중한 단일 페이지 웹앱.

## 차별화 포인트 (사용자 임팩트 순)

1. **한국어 + 한국판 카드** — 영문판 X
2. **박스 단위 시뮬** — 한국 사용자 실제 사용 패턴 (30팩 박스깡)
3. **홀로그래픽 효과** — 시각적 임팩트, 라이브러리 없이 직접 구현
4. **공유 링크 + 럭 점수** — SNS 바이럴
5. **카드별 사용자 리뷰** — 일러 / 소장가치 2축 별점 + 태그
6. **데이터 투명성** — 모든 확률에 출처 · 표본 크기 · 공식 비공개 안내

## 엔지니어링 차별화

- **점진적 백엔드 도입** — MVP는 백엔드 없는 정적 사이트. 사용자 트리거 기반으로 단계적 확장.
- **DAU 1만 명 기준 월 $20 이하** 운영 비용 목표.
- **모든 의사결정에 ID** — `D-NNN` 형식, 단일 SSOT 문서(`AGENTS.md`)로 관리.

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router) + TypeScript |
| 호스팅 (FE) | Cloudflare Pages |
| 정적 자산 / 이미지 | Cloudflare R2 + CDN |
| 백엔드 (Stage A~) | FastAPI (Python 3.12) on Fly.io |
| DB (Stage B~) | Neon (PostgreSQL) + SQLAlchemy 2.0 async |
| 캐시 | Upstash Redis |
| 인증 (Stage B~) | 구글 OAuth 2.0 (PKCE + state) |
| 스케줄러 | GitHub Actions Cron |
| 모니터링 | Sentry + UptimeRobot |
| 분석 | Cloudflare Web Analytics |

## 단계별 도입

| 단계 | 인프라 추가 | 트리거 | 예상 비용 |
|------|-----------|--------|---------|
| **MVP** | Cloudflare Pages, R2 (정적) | — | $0~1 |
| Stage A | + Fly.io, Upstash Redis | 사용자 100명 누적 | $0~5 |
| Stage B | + Neon Postgres | 사용자 1,000명 또는 리뷰 요구 | $5~15 |
| Stage C | + 외부 API, cron | F4 안정화 후 | $5~20 |
| Stage D | + Sentry, UptimeRobot, CF Analytics | F 단계 안정 | $5~20 |

각 단계 진입 시 블로그 포스트 작성, 트리거 도달 못 하면 다음 Stage 진입 금지.

## 데이터 정책

> "정확한 확률을 제공한다"가 아니라 **"가장 투명한 추정치를 제공한다"**

포켓몬 한국판 공식 봉입률은 비공개입니다. 우리가 표시하는 모든 확률은 추정치이며, **출처 + 표본 크기 + 공식 비공개 안내**를 항상 함께 노출합니다. 임의로 "그럴듯한" 숫자를 만들지 않습니다.

## 폴더 구조

```
.
├── AGENTS.md          # 단일 진실 원천 (SSOT)
├── README.md          # 이 파일
├── frontend/          # Next.js 앱 (MVP부터)
├── data/              # 카드 메타 / 확률 원천 데이터
└── docs/
    └── adr/           # Architecture Decision Records (10주차 일괄 작성)
```

## 개발

```bash
# 사전 요구사항
node --version    # >= 20
pnpm --version    # >= 9

# 셋업
cd frontend
pnpm install
pnpm dev
```

> ⚠️ MVP 진입 전(D2 카드 데이터 수집 단계)이라 `frontend/`는 아직 비어 있습니다.

## 로드맵 요약

자세한 의존성 그래프는 [`AGENTS.md` § 16](./AGENTS.md#16-로드맵-의존성-그래프) 참고.

```
[D] 인프라 셋업 → 카드 데이터 → ★ MVP 정적 사이트 첫 배포
                                      ↓ 사용자 100명
              [F1] 통계 — [F2] 럭 점수 — [F3] 공유 (Stage A: Redis만)
                                      ↓ 사용자 1,000명
              [F4] OAuth — [F5] 리뷰 — [F6] 랭킹 (Stage B: Postgres)
                                      ↓
                            [F7] 시세 (Stage C)
                            [F8] 홀로 효과 (독립적)
                                      ↓
                       Stage D: 운영 + 폴리싱
```

## 라이선스

미정 (10주차 폴리싱 단계에서 결정).

## 참고

- 영문판 시뮬: [pokemonsim.com](https://pokemonsim.com) — 정적 사이트 구조 참고
- 홀로 효과 참고: [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)
- 한국 카드 정보: [카드몬스터](https://www.cardmon.com)
