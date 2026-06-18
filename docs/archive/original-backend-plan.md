# [ARCHIVED] 초기 백엔드 계획 (FastAPI + Fly.io + Neon + Redis)

> ⚠️ **이 문서는 superseded(대체)된 계획이다. 현재 구현과 다르다.**
>
> 2025-04 초기 설계 당시 AGENTS.md는 "정적 MVP → 트리거 기반 단계적 백엔드 도입(Stage A~D)"을
> 전제로, **FastAPI(Python) + Fly.io + Neon Postgres + Upstash Redis** 스택을 계획했다.
> AGENTS.md §6~11, §16에 이 계획의 상세(Stage 테이블, 시스템 아키텍처, 데이터 흐름,
> DB 스키마, API 엔드포인트, 의존성 그래프 로드맵)가 담겨 있었다.
>
> **실제로는 별도 백엔드 서버를 세우지 않았다.** 1인 운영 비용/속도를 고려해
> **Supabase(Postgres + RPC + RLS)** 하나로 통계·이벤트 추적·운 분포 참조를 처리하고,
> 시뮬/운 계산은 전부 클라이언트에서 돌리는 구조로 갔다. 결과적으로:
>
> - `backend/`(FastAPI) 폴더 없음 — Fly.io 배포 없음
> - Neon 대신 **Supabase Postgres**
> - Upstash Redis 없음 — 통계 집계는 Supabase RPC로
> - SQLAlchemy/Alembic/uv 없음 — 마이그레이션은 `supabase/migrations/*.sql`
> - OAuth/리뷰/랭킹/시세 API(F4~F7)는 미구현 (현재 범위 밖)
> - 공유 OG 이미지 잡 큐 대신 **클라이언트 `html-to-image`** 로 결과 이미지 생성
>
> 현재 실제 구조는 AGENTS.md "실제 아키텍처(현재)" 절과 [README](../../README.md),
> 그리고 `docs/simulator-architecture.md` / `docs/card-set-pipeline.md`를 본다.
>
> 이 파일은 **포트폴리오상 "계획 → 피벗" 의사결정 기록**으로 보존한다. 새 작업의 기준으로 삼지 말 것.

---

## (원안) 백엔드 도입 단계

MVP는 백엔드 없는 정적 사이트. 백엔드는 기능별 트리거 시점에 단계적 도입하려 했다.

| 단계 | 인프라 추가 | 트리거 | 비용 |
|------|------------|--------|------|
| MVP | Cloudflare Workers (Static Assets), R2 (정적) | — | $0~1 |
| Stage A: F1, F2, F3 | + Fly.io, Upstash Redis | 사용자 100명 누적 | $0~5 |
| Stage B: F4, F5, F6 | + Neon Postgres | 사용자 1,000명 또는 리뷰 요청 | $5~15 |
| Stage C: F7 | + GitHub Actions cron, 외부 API | F4 안정화 후 | $5~20 |
| Stage D: 운영 | + Sentry, UptimeRobot, CF Analytics | F 단계 안정 | $5~20 |

각 단계 진입 시 블로그 포스트 작성으로 포트폴리오 임팩트를 노렸다.

---

## (원안) 시스템 아키텍처

### Stage A 진입 후 (F1, F2, F3 — Redis만)

```
사용자 브라우저
  ↓
Cloudflare Workers (정적) → Fly.io FastAPI
                              ↓
                          Upstash Redis
                          - 통계 카운터
                          - 공유 (TTL 7일)
                          - rate limit
```

### Stage B 진입 후 (F4, F5, F6 — Postgres 등장)

```
사용자 브라우저 (로그인 시 세션 쿠키)
  ↓
Cloudflare Workers → Fly.io FastAPI
                       ↓
              Neon Postgres ←→ Upstash Redis
              - users          - 통계 카운터
              - sessions       - 세션 캐시
              - cards (옮김)    - rate limit
              - card_ratings
              - pull_stats
```

### Stage C 진입 후 (F7 — 시세, 백그라운드)

위 구조 + GitHub Actions Cron:
- 시세 수집 (매일 04:00 KST)
- 통계 flush (매시간)
- 만료 share/세션 정리 (매일)
- 리뷰 요약 재계산 (매시간)

→ 외부 API: PokemonTCG.io, 환율 API

---

## (원안) 데이터 흐름

### Flow 3: 통계 flush (매시간, Stage B 이후)

1. GitHub Actions cron이 트리거
2. `POST /api/v1/jobs/flush-stats` 호출
3. FastAPI가 Redis 카운터 값 읽음
4. Postgres `pull_stats_hourly`에 누적값 INSERT

### Flow 4: 시세 수집 (매일 04:00 KST, Stage C)

1. GitHub Actions cron 트리거
2. PokemonTCG.io API에서 영문 카드 가격 fetch
3. 환율 변환 후 Postgres `price_external` INSERT
4. `price_summary` 캐시 테이블 갱신

### Flow 5: OAuth 로그인 (구글)

1. "리뷰 작성" 클릭, 익명 상태면 로그인 모달
2. `/api/v1/auth/google/start` → state + PKCE 생성
3. Redis에 state 저장 (TTL 10분)
4. 구글 OAuth 콜백 → 동의 → code → 토큰 교환
5. 구글 user info 조회 (sub, email, name, picture)
6. `users` UPSERT
7. 세션 생성: secure random ID → DB INSERT + Redis SET (TTL 30일)
8. HttpOnly + Secure + SameSite=Lax 쿠키

### Flow 6: 카드 리뷰 작성

1. 로그인 사용자가 "리뷰 쓰기" 클릭
2. 모달: 일러 별점(1~5), 소장가치 별점(1~5), 태그 다중 선택, 코멘트 50자
3. `POST /api/v1/cards/{id}/ratings`
4. 서버 검증(별점 범위, 코멘트 길이, 태그 코드, rate limit 일일 5건)
5. UPSERT: `(card_id, user_id)` 유니크

### Flow 7: 럭 점수 계산 + 결과 공유 (원안)

1. 클라이언트에서 럭 점수 계산: 점수 = -log10(p) 합산
2. 사전 빌드된 박스 분포 JSON에서 백분위 조회
3. `POST /api/v1/shares` (Redis SET, TTL 7일)
4. OG 이미지 비동기 생성 잡 큐 → R2 업로드 → `shares.og_image_url` 갱신

> 실제 구현은 OG 잡 큐 대신 클라이언트 `html-to-image`로 결과 이미지를 만든다.
> 운 분포는 정적 `luck_value_ref`(세트 JSON)와 `frontend/lib/luck.ts`로 계산한다.

---

## (원안) DB 스키마

상세 마이그레이션은 Stage B 진입 시 작성 예정이었다(미구현). 개념 요약만 남긴다.

### 사용자 / 인증 (Stage B~)

```
users                 OAuth 사용자 (provider + external_id), sub/email/display_name/avatar_url
sessions              세션 (Redis 캐시 + DB 백업), id/user_id/expires_at/user_agent/ip_inet
```

### 카드 / 시뮬

```
sets                  세트 마스터 + box_size/pack_size/가격/box_guarantees JSONB
rarities              레어도 마스터 (C, U, R, RR, SR, SAR, UR, AR)
cards                 개별 카드 (set_id + number 유니크)
pack_slots            팩 슬롯 확률표 + probability_source/sample_size/estimated_at
```

### 시세 (보조, Stage C~)

```
price_sources / exchange_rates / price_external / price_summary
```

### 통계 (Stage A Redis만, Stage B+ Postgres)

```
pull_stats_hourly / card_pull_counts
```

### 리뷰 (Stage B~)

```
rating_tags / card_ratings / card_rating_tags / card_comments / card_rating_summary
```

### 공유

```
shares                luck_score/luck_percentile/og_image_url/view_count (TTL 7일)
```

> 실제로는 위 스키마 대부분이 만들어지지 않았다. 카드 메타는 여전히 `data/sets/*.json`(SSOT)이고,
> Supabase에는 통계/이벤트/운 분포 관련 테이블과 RPC만 있다(`supabase/migrations/` 참조).

---

## (원안) API 엔드포인트 (FastAPI, 미구현)

### Stage A (Redis만)

```
POST /api/v1/stats/record               # 클라 시뮬 결과 보고
GET  /api/v1/stats/sets/{code}          # 세트별 글로벌 풀 비율
POST /api/v1/shares                     # 공유 링크 생성
GET  /api/v1/shares/{id}                # 공유 결과 조회
GET  /api/v1/og/shares/{id}.png         # 동적 OG 이미지
GET  /healthz
```

### Stage B (Postgres)

```
[ 인증 ]  GET /auth/google/start, /callback · POST /auth/logout · DELETE /auth/account · GET /auth/me
[ 카드 ]  GET /sets, /sets/{code}, /sets/{code}/cards, /sets/{code}/probabilities, /cards/{id}
[ 리뷰 ]  GET /cards/{id}/reviews · POST /cards/{id}/ratings · DELETE /cards/{id}/ratings
          POST /cards/{id}/comments · POST /comments/{id}/flag
[ 랭킹 ]  GET /rankings/by-art, /rankings/by-collection, /rankings/by-tag/{code}
```

### Stage C (시세)

```
GET /api/v1/prices/cards/{id} · GET /api/v1/prices/cards/{id}/history
```

### 운영 (Stage B+)

```
POST /api/v1/jobs/flush-stats · /jobs/recalc-rating-summary · /jobs/cleanup-sessions
```

> 실제 구현은 별도 API 서버 없이 Supabase 클라이언트(`@supabase/supabase-js`) + RPC로 처리한다.

---

## (원안) 로드맵 — 의존성 그래프

```
[D] 인프라 셋업 → [D] 카드 데이터 수집(1세트) → [★ MVP] 정적 박스 시뮬 + 첫 배포
  ↓ 사용자 100명 누적
========== Stage A: 백엔드 첫 등장 (Redis만) ==========
[F1] 글로벌 통계 — [F2] 럭 점수 — [F3] 공유 링크
  ↓ 사용자 1000명 또는 리뷰 요구
========== Stage B: Postgres 등장 ==========
[F4] OAuth(구글) → [F5] 카드 리뷰 → [F6] 랭킹 페이지
========== Stage C: 외부 데이터 ==========
[F7] 시세(보조)
[F8] 홀로 효과 (독립적)
========== Stage D: 운영 ==========
[P] CI/CD, Sentry, 분석, 라이브 카운터 / 폴리싱(README, ADR, 정책 페이지)
```

### 실제로 어떻게 갈렸나

- **D, ★ MVP, F2(럭 점수), F8(홀로 효과)** → 구현됨.
- **F1(글로벌 통계), F3(공유)** → FastAPI/Redis가 아니라 **Supabase + 클라이언트**로 구현.
- **F4~F7 (OAuth / 리뷰 / 랭킹 / 시세 API)** → 미구현. 단, "시세"는 외부 API가 아니라
  **일본판 시세 × 한국 보정계수**로 정적 산출해 "시세 운"으로 활용 (`docs/card-set-pipeline.md`).
- **Stage A~D 트리거 기반 단계적 도입** 자체가 폐기됨 — 처음부터 Supabase 한 방으로 단순화.

---

## 이 계획에서 살아남은 원칙

스택은 갈렸지만 아래 설계 원칙은 현재도 유효하다(AGENTS.md 본문 참조):

- 정적인 건 정적으로, 시뮬 로직은 클라이언트에서 (서버 비용 0)
- 큰 데이터(이미지)는 CDN(R2)으로
- 카드 메타 SSOT는 `data/sets/*.json`
- 확률은 추정치임을 항상 명시 (출처 메타)
