# AGENTS.md

> **이 파일이 PokéSim KR 프로젝트의 단일 진실 원천(SSOT)이다.**
>
> AI 어시스턴트(Claude, Cursor, Copilot 등)는 작업 시작 전 이 파일 전체를 읽는다.
> 사람도 새 결정/구현 전 이 파일을 본다.
>
> **변경 시 신중하게.** 결정이 흔들릴 때 항상 이 파일로 회귀.

---

## 목차

1. [프로젝트 정체성](#1-프로젝트-정체성)
2. [4가지 목표](#2-4가지-목표)
3. [비목표와 비전](#3-비목표와-비전)
4. [차별화 포인트](#4-차별화-포인트)
5. [핵심 원칙 4가지](#5-핵심-원칙-4가지)
6. [기술 스택](#6-기술-스택)
7. [백엔드 도입 단계](#7-백엔드-도입-단계)
8. [시스템 아키텍처](#8-시스템-아키텍처)
9. [데이터 흐름](#9-데이터-흐름)
10. [DB 스키마](#10-db-스키마)
11. [API 엔드포인트](#11-api-엔드포인트)
12. [데이터 정책](#12-데이터-정책)
13. [접근 제어 정책](#13-접근-제어-정책)
14. [시뮬 화면 원칙](#14-시뮬-화면-원칙)
15. [의사결정 인덱스](#15-의사결정-인덱스)
16. [로드맵 (의존성 그래프)](#16-로드맵-의존성-그래프)
17. [코딩 컨벤션](#17-코딩-컨벤션)
18. [현재 작업 단계](#18-현재-작업-단계)
19. [흔한 실패 패턴](#19-흔한-실패-패턴)
20. [변경 이력](#20-변경-이력)

---

## 1. 프로젝트 정체성

### 한 줄 정의

한국 포켓몬 TCG 사용자가 **박스깡(30팩)**을 시뮬레이션하고, 럭 점수와 카드 리뷰를 공유하는 웹 서비스.

### 프로젝트 이름

**PokéSim KR** (도메인: 추후 결정)

### 참고 사이트

- pokemonsim.com — 영문판 시뮬레이터, 정적 사이트 구조 참고
- simeydotme/pokemon-cards-css — 홀로 효과 참고 (직접 구현)
- **pokemoncard.co.kr** — 한국판 카드 메타 SSOT (D-038에 따라 카드몬스터 폐기, 이쪽으로 일원화)

---

## 2. 4가지 목표

우선순위가 아니라 **병행 목표**. 모든 결정은 4개 다 균형 있게 봐야 한다.

1. **사용자 유치** — 친구한테 "오 이거 좋다", SNS 공유 유발, 재방문
2. **저비용 운영** — 사용자 1만 명 일일 활성 기준 월 $20 이하
3. **추후 확장 가능성** — v2 자판기 지도, v3 커뮤니티/사진 분석까지 염두
4. **포트폴리오 가치** — 풀스택 역량 어필 (FE/BE/DB/인프라/DevOps)

### 4개 목표 사이의 트레이드오프

목표끼리 충돌할 때:

- **사용자 유치 vs 포트폴리오** → 사용자 유치 우선
- **저비용 vs 사용자 유치** → 비용 양보 가능 (월 $50까지 OK)
- **확장 vs 빠른 구현** → MVP 범위 안에서는 빠른 구현. 단, 미래 확장 막는 결정 X
- **포트폴리오 vs 빠른 구현** → 빠른 구현. "직접 구현 vs 라이브러리"는 둘 다 OK

수익화는 목표가 **아님**. 광고/결제 미도입.

---

## 3. 비목표와 비전

### 비목표 (절대 안 함)

- ❌ 컬렉션 영구 저장 (사용자별 카드 수집 기록)
- ❌ 사용자 간 상호작용 (DM, 친구, 팔로우)
- ❌ 카드 거래 / 결제
- ❌ 실시간 멀티플레이
- ❌ 모바일 앱 (네이티브)
- ❌ 광고
- ❌ C2C 플랫폼 크롤링 (번개장터, 당근, 중고나라)

### 부분 도입 (조건부)

- ⚠️ 로그인 — 리뷰 작성 등 일부 기능에만. 시뮬은 영원히 익명. 자세히는 [13. 접근 제어 정책](#13-접근-제어-정책)

### 비전 (시기 미정)

**v2 — 자판기 지도** (사용자 베이스 모이면)
- Google Maps API에 한국 포켓몬 자판기 위치
- 사용자 제보 기반
- 비용: Google Maps 무료 티어

**v3 — 정보 공유 커뮤니티 + 카드 사진 센터링 분석** (DAU 1,000+ 후)
- 덱 빌드 공유, 카드 정보 위키
- 카드 사진 센터링 분석 (OpenCV.js 클라이언트 처리)
  - "센터링만" 한정. PSA 등급 추정 X.
  - 사용자 사진 서버에 안 올림 (사생활)

**시기 미정 (재밌으면 고려)**
- 카드 위시리스트 (좋아요 누적, 익명)
- 대량 시뮬 (10박스, 카톤 12박스)
- 한국 카드샵 디렉토리
- 토너먼트 일정 캘린더
- "오늘의 카드"

### 새 기능 결정 가이드

새 아이디어 떠올랐을 때:
1. 비목표인가? → 안 함
2. 비전(v2/v3)인가? → 노션 아이디어 인박스
3. 지금 할 일인가? → ROADMAP에 추가, AGENTS.md 갱신

---

## 4. 차별화 포인트

pokemonsim.com이 안 하는 것 = 우리의 가치. **사용자 임팩트 순으로 정렬**.

### 사용자 1순위 (5초 안에 느낌)

1. **한국어 + 한국판 카드** — 영문판 X
2. **박스 단위 시뮬** — 한국 사용자 실제 사용 패턴 (30팩 박스깡)
3. **홀로그래픽 효과** — 시각적 임팩트
4. **공유 링크 + 럭 점수** — SNS 바이럴

### 사용자 2순위 (재방문 가치)

5. **카드별 사용자 리뷰** — 일러/소장가치 2축 별점 + 태그 (로그인)
6. **랭킹 페이지** — "일러 미쳤다 TOP" 등 메타 콘텐츠

### 보조 정보

7. 글로벌 통계 — 라이브 카운터
8. 시세 표시 — 데이터 있는 카드만 가볍게
9. 데이터 투명성 — 모든 확률에 출처 명시

### 엔지니어링 차별화 (포트폴리오)

- **점진적 백엔드 도입** — MVP는 정적, 트리거별 단계적
- **사용자 데이터 기반 트리거** — N명 누적 시 다음 단계
- **데이터 투명성** — 추정치는 추정치라고
- **비용 최적화** — Cloudflare R2 (egress 무료) 등

---

## 5. 핵심 원칙 4가지

흔들릴 때 돌아올 4가지 원칙. 새 결정도 이 기준에 맞는지 본다.

1. **정적인 건 정적으로** — 빌드 타임에 만들 수 있는 건 다 빌드 타임에. 서버 호출 0 지향.
2. **트래픽 큰 건 엣지로** — 이미지 같은 큰 데이터는 무조건 CDN.
3. **쓰기는 모았다가 한 번에** — Redis 같은 빠른 저장소에 쌓아놓고 주기적으로 DB로 flush.
4. **백그라운드는 별도 잡으로** — 사용자 요청과 무관한 일은 cron으로 분리.

---

## 6. 기술 스택

| 영역 | 선택 | 변경 가능? |
|------|------|----------|
| 프론트엔드 프레임워크 | Next.js 15 (App Router) + TypeScript | ❌ 고정 |
| 프론트 호스팅 | Cloudflare Workers (Static Assets) | ❌ 고정 |
| 이미지 / 정적 자산 | Cloudflare R2 + CDN | ❌ 고정 |
| 백엔드 프레임워크 | FastAPI (Python 3.12) | ❌ 고정 |
| 백엔드 호스팅 | Fly.io | ⚠️ 변경 가능하지만 신중히 |
| DB | Neon (PostgreSQL) | ❌ 고정 |
| 캐시 | Upstash Redis | ❌ 고정 |
| 인증 | 구글 OAuth 2.0 (PKCE + state) | ❌ 고정 (카카오는 v2) |
| 세션 관리 | Redis 캐시 + DB 백업 (하이브리드) | ❌ 고정 |
| 마이그레이션 | Alembic | ❌ 고정 |
| ORM | SQLAlchemy 2.0 (async) | ❌ 고정 |
| 패키지 매니저 (Python) | uv | ❌ 고정 |
| 패키지 매니저 (Node) | pnpm | ❌ 고정 |
| 스케줄러 | GitHub Actions Cron | ❌ 고정 |
| CI/CD | GitHub Actions | ❌ 고정 |
| 모니터링 | Sentry + UptimeRobot | ❌ 고정 |
| 분석 | Cloudflare Web Analytics | ❌ 고정 |
| 상태 관리 (FE) | Zustand | ❌ 고정 |
| 스타일링 | Tailwind CSS | ❌ 고정 |
| 애니메이션 | Framer Motion | ❌ 고정 |

---

## 7. 백엔드 도입 단계

**MVP는 백엔드 없는 정적 사이트.** 백엔드는 기능별 트리거 시점에 단계적 도입.

| 단계 | 인프라 추가 | 트리거 | 비용 |
|------|------------|--------|------|
| MVP | Cloudflare Workers (Static Assets), R2 (정적) | — | $0~1 |
| Stage A: F1, F2, F3 | + Fly.io, Upstash Redis | 사용자 100명 누적 | $0~5 |
| Stage B: F4, F5, F6 | + Neon Postgres | 사용자 1,000명 또는 리뷰 요청 | $5~15 |
| Stage C: F7 | + GitHub Actions cron, 외부 API | F4 안정화 후 | $5~20 |
| Stage D: 운영 | + Sentry, UptimeRobot, CF Analytics | F 단계 안정 | $5~20 |

각 단계 진입 시 **블로그 포스트 작성** (포트폴리오 임팩트 최대화).

**중요**: 트리거 도달 못 하면 다음 Stage 진입 X. 사용자 모으는 데 집중.

---

## 8. 시스템 아키텍처

### MVP 단계 (정적 사이트)

```
사용자 브라우저
  ↓
Cloudflare Workers (Next.js 정적, Static Assets) ← public/sets/*.json, public/distrib/*
  ↓
Cloudflare R2 + CDN (카드 이미지)

# 백엔드 없음 # DB 없음 # Redis 없음 # 비용 ~$1/월
```

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

# Postgres 없음 # 비용 ~$5/월
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

# 비용 ~$10/월
```

### Stage C 진입 후 (F7 — 시세, 백그라운드)

위 구조 + GitHub Actions Cron:
- 시세 수집 (매일 04:00 KST)
- 통계 flush (매시간)
- 만료 share/세션 정리 (매일)
- 리뷰 요약 재계산 (매시간)

→ 외부 API: PokemonTCG.io, 환율 API

비용 ~$15~20/월

---

## 9. 데이터 흐름

### Flow 1: 사용자 첫 방문

1. 브라우저가 Cloudflare Workers에서 Next.js 빌드 결과 받음 (Static Assets)
2. JS 실행 → CDN에서 세트 메타 JSON fetch (캐시됨)
3. 카드 풀, 확률표를 메모리에 로드
4. **이 시점까지 백엔드 호출 0회**

### Flow 2: 사용자가 박스를 깜 (메인 시뮬)

1. "박스 까기" 클릭 (165,000원짜리)
2. **클라이언트에서** 박스 시뮬 실행:
   - 박스 보장 슬롯 먼저 생성 (RR N개, SR M개 룰)
   - 30팩 순회하며 보장 또는 가중치 추첨
   - 셔플
3. 카드 이미지 150장을 R2에서 fetch (CDN 캐시)
4. **순차 팩 펼침 애니메이션** (30팩 차례로) + 홀로 효과
5. 사용자가 "건너뛰기" 누르면 → 결과 요약 화면으로 점프
6. 백그라운드로 `POST /api/v1/stats/record` (실패해도 UX 영향 X)
7. FastAPI가 Redis HINCRBY로 카운터 증가

### Flow 2-b: 사용자가 1팩만 깜 (옵션)

1. "1팩만 까기" 옵션 선택 (5,500원짜리)
2. **클라이언트에서** 단일 팩 시뮬 (보장 슬롯 없이 가중치만)
3. 카드 5장 fetch + 펼침
4. 통계 보고는 박스와 동일 (단, `unit: 'pack'`)

### Flow 3: 통계 flush (매시간, Stage B 이후)

1. GitHub Actions cron이 트리거
2. `POST /api/v1/jobs/flush-stats` 호출
3. FastAPI가 Redis 카운터 값 읽음
4. Postgres `pull_stats_hourly`에 누적값 INSERT
5. Redis 카운터는 그대로 두고 누적

### Flow 4: 시세 수집 (매일 04:00 KST, Stage C)

1. GitHub Actions cron 트리거
2. PokemonTCG.io API에서 영문 카드 가격 fetch
3. 환율 변환 후 Postgres `price_external` INSERT
4. `price_summary` 캐시 테이블 갱신

### Flow 5: OAuth 로그인 (구글)

1. "리뷰 작성" 클릭, 익명 상태면 로그인 모달
2. "구글로 시작하기" 클릭
3. `/api/v1/auth/google/start` → state + PKCE 생성
4. Redis에 state 저장 (TTL 10분)
5. 구글 OAuth 콜백 → 사용자 동의
6. 구글이 `/callback`으로 리디렉션 (code + state)
7. 백엔드가 state 검증, code → 토큰 교환
8. 구글 user info 조회 (sub, email, name, picture)
9. `users` UPSERT
10. 세션 생성: secure random ID → DB INSERT + Redis SET (TTL 30일)
11. HttpOnly + Secure + SameSite=Lax 쿠키

### Flow 6: 카드 리뷰 작성

1. 로그인 사용자가 "리뷰 쓰기" 클릭
2. 모달: 일러 별점 (1~5), 소장가치 별점 (1~5), 태그 다중 선택, 코멘트 50자 (선택)
3. `POST /api/v1/cards/{id}/ratings`
4. 서버 검증:
   - 별점 1~5
   - 코멘트 길이 50자 이하
   - 태그는 미리 정의된 코드만
   - Rate limit: 사용자당 일일 코멘트 5건
5. UPSERT: `(card_id, user_id)` 유니크
6. `card_rating_summary` 갱신은 다음 cron에서

### Flow 7: 럭 점수 계산 + 결과 공유

1. 사용자가 박스를 깜
2. **클라이언트에서** 럭 점수 계산:
   - 각 카드 등장 확률 p에 대해 점수 = -log10(p)
   - 박스 전체 150장 합산 = 박스 점수
3. 사전 빌드된 박스 분포 JSON에서 백분위 조회 ("상위 0.5%")
4. "공유" 클릭
5. `POST /api/v1/shares` (card_ids, luck_score, luck_percentile, unit='box')
6. OG 이미지 비동기 생성 잡 큐
7. R2에 업로드되면 `shares.og_image_url` 갱신
8. 공유 URL 접속 시 OG 메타태그로 카톡/트위터 미리보기

### Flow 8: 사전 시뮬 분포 빌드 (빌드 타임)

1. 빌드 시점에 각 세트별로 **박스 100만 번** 시뮬
2. 박스 점수 분포를 정렬된 배열로 저장
3. `public/distributions/{set_code}_box.json` 정적 배포
4. 팩 단위 분포도 별도 빌드 (`{set_code}_pack.json`)
5. 클라이언트가 첫 방문 시 한 번만 fetch
6. 이진 검색으로 백분위 조회

---

## 10. DB 스키마

상세 마이그레이션 파일은 Stage B 진입 시 작성. 여기는 개념 요약.

### 사용자 / 인증 (Stage B~)

```
users                 OAuth 사용자 (provider + external_id)
                      sub, email, display_name, avatar_url 등
sessions              세션 (Redis 캐시 + DB 백업)
                      id, user_id, expires_at, user_agent, ip_inet
```

### 카드 / 시뮬

```
sets                  세트 마스터 (sv8a, base1)
                      + box_size (보통 30), pack_size (보통 5)
                      + box_price_krw, pack_price_krw
                      + box_guarantees JSONB (RR 최소/최대 룰, 추정치 메타)
rarities              레어도 마스터 (C, U, R, RR, SR, SAR, UR, AR)
cards                 개별 카드 (set_id + number 유니크)
pack_slots            팩 슬롯 확률표 (시뮬 핵심)
                      + probability_source, sample_size, estimated_at
```

### 시세 (보조, Stage C~)

```
price_sources         가격 출처 (tcgplayer 등)
exchange_rates        환율 (KRW 기준)
price_external        해외 API 시세 이력
price_summary         카드별 통합 대표 시세 (캐시)
```

### 통계 (Stage A는 Redis만, Stage B+에서 Postgres에도)

```
pull_stats_hourly     시간 버킷 통계 집계
card_pull_counts      카드별 누적 풀 횟수 (참고용)
```

### 리뷰 (Stage B~)

```
rating_tags           미리 정의 태그 마스터 (art_amazing 등)
card_ratings          사용자 별점 (일러/소장가치 2축, user_id 유니크)
card_rating_tags      카드별 태그 카운트
card_comments         50자 짧은 코멘트 (신고 모더레이션)
card_rating_summary   카드별 리뷰 요약 캐시 (1시간 재계산)
```

### 공유

```
shares                공유 결과 (TTL 7일 — Stage A는 Redis, Stage B+는 Postgres)
                      + luck_score, luck_percentile, og_image_url, view_count
```

---

## 11. API 엔드포인트

Stage별로 점진적으로 추가됨.

### Stage A (Redis만)

```
POST /api/v1/stats/record               # 클라 시뮬 결과 보고 (rate limited, 익명)
GET  /api/v1/stats/sets/{code}          # 세트별 글로벌 풀 비율

POST /api/v1/shares                     # 공유 링크 생성 (Redis SET, TTL 7일)
GET  /api/v1/shares/{id}                # 공유 결과 조회
GET  /api/v1/og/shares/{id}.png         # 동적 OG 이미지

GET  /healthz                           # 헬스체크
```

### Stage B (Postgres 등장)

```
[ 인증 ]
GET  /api/v1/auth/google/start          # OAuth 시작 (state + PKCE)
GET  /api/v1/auth/google/callback       # OAuth 콜백
POST /api/v1/auth/logout                # 세션 무효화
DELETE /api/v1/auth/account             # 계정 삭제 (개보법 의무)
GET  /api/v1/auth/me                    # 현재 사용자 정보

[ 카드 / 세트 ]
GET  /api/v1/sets                       # 활성 세트 목록 (캐시 1시간)
GET  /api/v1/sets/{code}                # 세트 상세 + 카드 + pack_slots
GET  /api/v1/sets/{code}/cards          # 카드 목록 (캐시 1일)
GET  /api/v1/sets/{code}/probabilities  # 표시 확률 + 출처 + 관측
GET  /api/v1/cards/{id}                 # 단일 카드 상세

[ 리뷰 ] — 작성은 로그인 필요
GET  /api/v1/cards/{id}/reviews         # 별점 + 태그 통계 (익명 가능)
POST /api/v1/cards/{id}/ratings         # 별점 + 태그 등록/수정 (로그인)
DELETE /api/v1/cards/{id}/ratings       # 본인 리뷰 삭제 (로그인)
POST /api/v1/cards/{id}/comments        # 짧은 코멘트 (로그인)
POST /api/v1/comments/{id}/flag         # 코멘트 신고 (로그인)

[ 랭킹 ]
GET  /api/v1/rankings/by-art            # 일러 평점 TOP
GET  /api/v1/rankings/by-collection     # 소장가치 TOP
GET  /api/v1/rankings/by-tag/{code}     # 특정 태그 TOP
```

### Stage C (시세)

```
GET  /api/v1/prices/cards/{id}          # 시세 (있는 경우만)
GET  /api/v1/prices/cards/{id}/history  # 시세 이력
```

### 운영 (Stage B+)

```
POST /api/v1/jobs/flush-stats           # cron 전용
POST /api/v1/jobs/recalc-rating-summary # cron 전용 (리뷰 요약)
POST /api/v1/jobs/cleanup-sessions      # cron 전용 (만료 세션 정리)
```

### 정적 자산 (Cloudflare Workers Static Assets)

```
/sets/{code}.json                       # 세트 메타 (MVP부터)
/distributions/{set_code}_box.json      # 박스 단위 럭 점수 분포
/distributions/{set_code}_pack.json     # 팩 단위 (옵션 모드용)
```

---

## 12. 데이터 정책

### 핵심 사실

1. **포켓몬 한국판의 공식 봉입률은 비공개다.**
2. **존재하는 모든 한국판 확률은 추정치다.**
3. **이 한계를 숨기지 않는 게 차별화 포인트다.**

### 우리의 데이터 정책

> "정확한 확률을 제공한다" 가 아니라 "가장 투명한 추정치를 제공한다"

### 확률 표시 원칙

모든 확률 표시에는 다음 4가지가 함께 노출된다:

1. **표시 확률** (가장 신뢰하는 추정치)
2. **출처** (어떤 데이터에서 왔는지)
3. **표본 크기** (통계의 신뢰도 가늠용)
4. **공식 비공개 안내**

예시:
```
RR 등장 확률
- 표시 확률: 6.7%
- 출처: 커뮤니티 박스깡 사례 + 우리 사이트 관측
- 우리 관측: 6.5% (12,453 팩)
- ⓘ 공식 봉입률은 비공개입니다
```

### 시세 표시 원칙

마찬가지로 출처 항상 명시:

```
가디안 ex SAR
- 표시 시세: 18,000원 (한국 실거래가 추정)
- 출처: 사용자 제보 12건 (최근 30일)
- 해외 참고가: ₩17,200 (TCGPlayer 환산)
- ⓘ 시세는 변동성이 큽니다
```

### 확률 데이터 출처 (우선순위)

**Tier P1: 우리 자체 관측**
- DB의 `card_pull_counts` + `pull_stats_hourly`
- 한계: 시뮬 결과 기반, 의미 제한적
- 활용: "참고 데이터"로만, 메인 X

**Tier P2: 커뮤니티 합의 추정치 (메인)**
- 출처: 디시 포카게 마이너 갤러리, 트위터/X에서 형성된 봉입률 합의
- **단일 박스깡 인증글 / 단일 사용자 결과는 메인 X** — 잘 나온 사례만 올라가는 편향
- 카드몬스터는 메인 X (D-038, 데이터 부실). 보조 참고만 가능.
- 한계: 표본 작음, 세트별 다름, 합의도 정확하지 않을 수 있음
- 활용: 신상 출시 후 2~4주 합의 누적되면 갱신
- 출처 메타에 "커뮤니티 합의 (소스: 디시 포카게갤 / X 종합)" 형태로 명시 필수

**Tier P3: 영문판/일본판 봉입률 추정**
- PokemonTCG.io, 영문 위키
- 한계: 한국판과 다를 수 있음
- 활용: P1, P2 부족할 때 보조

### 시세 데이터 출처

**시세는 차별화가 아닌 보조 정보** (D-031).

**Tier S1: 해외 시세 환율 변환** (메인) — PokemonTCG.io, TCGPlayer
**Tier S2: 한국 카드샵 정가** (보강) — TCGShop 등, 협조 요청 후
**Tier S3: 사용자 제보** (v2 이후)

### 절대 금지

- ❌ 임의로 "그럴듯한" 확률 만들어 넣기
- ❌ "공식 확률"이라고 표기 (실제로는 추정치)
- ❌ 출처 없이 숫자만 표시
- ❌ C2C 플랫폼 크롤링 (번개장터/당근/중고나라)
- ❌ 광고/제휴 시세 노출
- ❌ "실시간 시세" 표현 (실제로는 1일 갱신)
- ❌ 시세를 차별화 포인트로 강조

### 박스 vs 팩 시뮬레이션

- **MVP**: 박스 단위 시뮬 (메인) + 1팩 옵션
- **박스 보장 룰**: 추정치, `_source` + `_sample_size` + `_estimated_at` 메타 필수
- 데이터 부족 시 영문판 봉입률 차용 + 보정계수 (1.2~1.5)
- **임의로 보정 X**, 항상 근거 데이터 필요

### 데이터 갱신 정책

- **카드 메타**: 신상 발매 후 1주 안에 수동 입력 (출처: pokemoncard.co.kr)
- **확률 추정치**: 발매 후 2주~1개월 모니터링, 1개월 후 갱신, 이후 분기별
- **시세**: 사용자 제보 실시간 (캐시 1시간), 카드샵/해외 API 매일 04:00 KST

---

## 13. 접근 제어 정책

### 핵심 원칙

1. **시뮬은 영원히 익명이다.** 팩 까기에 로그인 강요 X.
2. **사용자 식별이 데이터 품질에 직결되는 기능만 로그인.**
3. **로그인 깔때기는 자연스럽게.**

### 영원히 익명 (로그인 절대 강제 X)

- 팩/박스 까기 시뮬
- 럭 점수 + 백분위 표시
- 카드 보기 / 검색
- 세트 페이지
- 글로벌 통계 보기
- 리뷰 **읽기**
- 시세 **보기**
- 공유 링크 생성/조회
- 랭킹 페이지 보기

### 로그인 필요

- 리뷰 작성 (별점, 태그, 코멘트)
- 자기 리뷰 수정/삭제
- 시세 제보 (v2)
- 신고 (리뷰/시세)

### 인증 방식

- 제공자: 구글 OAuth 2.0 (MVP)
- 카카오: v2 추가 예정
- 세션: Redis 캐시 + DB 백업 (하이브리드)
- 쿠키: HttpOnly + Secure + SameSite=Lax
- CSRF 방어: state 파라미터
- Auth Code 가로채기 방어: PKCE

### 개인정보 / 컴플라이언스

OAuth 도입 = 개인정보 처리자.

**필수 (Stage D 안에)**
- 개인정보처리방침 페이지
- 이용약관 페이지
- 회원 탈퇴 (즉시, grace 없음)
- 데이터 다운로드 (개보법)

**최소 수집**
- 구글에서 받기: `sub`, `email`, `name`, `picture`
- 표시는 `name`, `picture`만
- email은 식별/통신용, 공개 X

---

## 14. 시뮬 화면 원칙

**시뮬 화면은 담백하게 유지한다.**

**박스 단위가 메인 시뮬이다.** 한국 사용자 실제 사용 패턴 (박스깡 인증).
팩 단위는 "1팩만 까보기" 옵션으로 작게 제공.

핵심 정보만 노출:
- 얼마 썼나 (박스 가격 165,000원)
- 얼마 얻었나 (레어도별 카운트)
- 컬렉션 가치 vs 지출 (손익 표시 — Stage C 시세 도입 후)

박스 결과는 **순차 팩 펼침 기본 + 건너뛰기 옵션**. 처음엔 두근거림, 두 번째부터 빠르게.

차별화 기능들(럭 점수, 리뷰, 확률 비교, 시세)은 **결과 모달이나 카드 디테일 페이지로 분리**.
시뮬 = 가볍고 즐거운 곳, 카드 디테일 = 정보 깊은 곳.

복잡함 추가하고 싶을 때마다 이 원칙 확인.

---

## 15. 의사결정 인덱스

ID 부여된 결정 한 줄 요약. 깊은 이유는 `docs/adr/` 폴더 (10주차 폴리싱 시 작성).

### 인프라 / 호스팅

- **D-001** 정적 자산은 Cloudflare R2 + CDN — egress 무료가 압도적
- **D-002** 프론트는 Cloudflare Workers (Static Assets) — 정적 자산 대역폭 무제한 무료, 2026 Cloudflare 일원화 흐름, `wrangler.toml`로 D-136 정합 (2026-04-30 변경, 원래 Pages였음)
- **D-003** 백엔드는 Fly.io — Scale-to-zero
- **D-004** DB는 Neon — 서버리스, Git 브랜치 가능
- **D-005** 캐시는 Upstash Redis — 서버리스, 무료 티어

### 백엔드

- **D-010** 백엔드 언어는 Python (FastAPI) — 1인 개발 속도 + 데이터 직무
- **D-011** ORM은 SQLAlchemy 2.0 async
- **D-012** 마이그레이션 backward-compatible 강제
- **D-013** Repository 패턴

### 프론트엔드

- **D-020** Next.js App Router + TypeScript
- **D-021** 시뮬 로직은 클라이언트에서 — 서버 비용 0
- **D-022** 상태 관리는 Zustand
- **D-023** Tailwind CSS
- **D-024** 홀로 효과 직접 구현 (라이브러리 X)

### 데이터 / 시세

- **D-030** C2C 크롤링 X — 통신망법 침입죄 판례
- **D-031** 시세는 보조 정보로 격하 — 한국 데이터 부재
- **D-032** 해외 API는 PokemonTCG.io 우선
- **D-033** 카드 이미지는 비영리 + 디스클레이머
- **D-034** 확률 데이터는 추정치임을 항상 명시
- **D-035** 임의로 그럴듯한 확률 만들지 않음
- **D-036** 우리 관측 확률은 메인 X (참고용)
- **D-037** ~~박스 단위 시뮬은 v2 이후~~ (폐기 → D-101)
- **D-038** ~~카드몬스터 표준~~ (폐기, 데이터 부실). 보조 참고만 가능, 카드 메타/확률/시세 SSOT 아님. 한국 카드 메타 SSOT는 **pokemoncard.co.kr** (12절)

### 통계 / 데이터 처리

- **D-040** 통계는 Redis 카운터 + 시간당 flush
- **D-041** 시간 버킷 단위로만 영구 저장
- **D-042** 사용자 제보는 5단계 검증

### 보안 / 운영

- **D-050** 로그인은 부분 도입 — 시뮬 익명, 리뷰만
- **D-051** Rate Limit은 Redis Sorted Set 슬라이딩 윈도우
- **D-052** 모든 cron은 GitHub Actions
- **D-053** 모니터링은 Sentry + UptimeRobot 무료

### 기능 범위

- **D-060** 로그인 부분 도입 (변경됨)
- **D-061** 컬렉션 영구 저장 X
- **D-062** 광고 X
- **D-063** 결제 X
- **D-064** 모바일 앱 X
- **D-065** 사용자 간 상호작용 X

### 인증

- **D-070** OAuth는 구글로 시작, 카카오는 v2
- **D-071** 시뮬은 영원히 익명
- **D-072** 리뷰 작성은 로그인 필요
- **D-073** 세션은 Redis 캐시 + DB 백업 하이브리드
- **D-074** OAuth는 PKCE + state 필수
- **D-075** 세션 쿠키는 HttpOnly + Secure + SameSite=Lax
- **D-076** 개인정보는 최소 수집
- **D-077** 계정 삭제는 즉시 (grace 없음)

### 리뷰 시스템

- **D-080** 리뷰는 2축 (일러 / 소장가치)
- **D-081** 리뷰 텍스트는 태그 + 50자 코멘트
- **D-082** 한 사용자 한 카드 한 번만 (UPSERT)
- **D-083** 리뷰 5건 이상부터 별점 표시
- **D-084** 시드 리뷰는 본인 작성
- **D-085** 카드 단위 리뷰만, 사용자 프로필 없음

### UX / 화면

- **D-090** 시뮬 화면은 담백하게
- **D-091** 운영 지표는 Cloudflare Web Analytics만 (MVP)
- **D-092** 라이브 카운터를 메인페이지에 노출

### 로드맵

- **D-093** 주차별 → 기능별 의존성 그래프
- **D-094** 비목표와 비전을 분리

### 프로젝트 목표

- **D-095** 목표 4개 병행
- **D-096** 사용자 유치 vs 포트폴리오 충돌 시 사용자 우선
- **D-097** 비용 한도는 사용자 1만 명 / 월 $20

### 카드 사진 분석 (v3)

- **D-098** 카드 사진 분석은 "센터링만" 한정
- **D-099** 클라이언트 처리 (OpenCV.js)
- **D-100** 사진 분석은 v3

### 시뮬 단위

- **D-101** 박스 단위 시뮬이 메인 (D-037 폐기)
- **D-102** 팩 단위는 옵션 (메인은 박스)
- **D-103** 박스 보장 룰은 추정치 + 출처 메타
- **D-104** 박스 결과 펼침은 순차 + 건너뛰기
- **D-105** 대량 시뮬 (10박스, 카톤)은 v2
- **D-106** 럭 점수 분포는 박스/팩 분리 빌드

### 점진적 백엔드 도입

- **D-110** MVP는 정적 사이트 (백엔드 없음)
- **D-111** 백엔드 도입은 트리거 기반
- **D-112** Stage A는 Redis-only (Postgres 없음)
- **D-113** 카드 데이터 마이그레이션은 한 방향 (정적 → DB)
- **D-114** 통계 데이터 마이그레이션 (Redis → Postgres)
- **D-115** 도입 시점이 ADR 거리
- **D-116** 트리거 도달 못하면 Stage 진입 X

### 코딩 컨벤션

- **D-120** 명명은 언어별 관습 (TS=camelCase, Python=snake_case)
- **D-121** 파일명은 소문자 + 케밥 (TS) / snake_case (Python)
- **D-122** 커밋은 Conventional Commits (`feat: ...`, 한국어 설명)
- **D-123** 버전은 git tag로 관리 (커밋에 [v1] 안 붙임)
- **D-124** 브랜치는 main + 기능 브랜치 (1인이라 단순화)
- **D-125** ESLint/Prettier는 Next.js 기본 + 최소 커스텀

### 시뮬 알고리즘 세부

- **D-126** 박스 보장 슬롯 위치는 랜덤 (예측 불가)
- **D-127** 카드 중복 허용 (한 박스 같은 SR 두 장 가능)
- **D-128** 1팩 모드는 박스 보장 룰 + 갓팩 메커니즘 무시
- **D-129** 시드 기반 시뮬 (seedrandom) — 공유 결과 검증 가능
- **D-130** 갓팩 메커니즘 도입 (박스당 1% 확률, RR/SR/SAR 가중치 ×5)
- **D-131** 셔플은 Fisher-Yates

### 안전 / 변경 되돌리기

- **D-132** 작업 단위 작게 + 커밋 자주 (한 커밋 = 한 의도)
- **D-133** AI 어시스턴트 변경은 받은 즉시 검토 + 커밋해서 박제 (AI 결과 위 AI 결과 덮어쓰기 X)
- **D-134** main 브랜치 GitHub branch protection ON (직접 push 금지, PR 머지만)
- **D-135** 위험 git 명령 전 백업 브랜치 (`git branch backup/<날짜>`)
- **D-136** 인프라/시크릿 변경은 코드로 관리 (콘솔 수동 변경 X)
- **D-137** 외부 API 호출은 dev/staging 분리 또는 dry-run 모드
- **D-138** 롤백 시나리오 박제 (git revert + Workers rollback + DB backward-compatible)

### 데이터 수집 / 세트 관리

- **D-139** D2는 다중 세트 동시 시작 — 한국판 현재 발매 중 라인업(닌자스피너 / MEGA 드림 ex / 니힐제로 / 블랙볼트 등 MEGA 시리즈) 동시 처리. 신상 발매 시 동일 스키마로 추가, 별도 D-NNN 부여 X (운영 절차로 흡수). 카드 메타 SSOT는 pokemoncard.co.kr.

### MVP UX / 시뮬 세부

- **D-140** SetPicker 화면 분리 — 세트 선택은 별도 화면 (App → SetPicker → BoxSimulator 플로우)
- **D-141** 4가지 박스깡 모드 — 자동(팩별 자동 진행) / 수동(카드별 클릭) / 즉시(결과 바로) / 1팩
- **D-142** 세션 누적은 `localStorage` 영속화 — 세트 변경/새로고침해도 유지, 사용자 직접 리셋만
- **D-143** UR/MUR 표시 분리 — 데이터 태그는 `'UR'` 유지, UI 노출은 `'MUR'`로 매핑 (메가시리즈 한정)
- **D-144** 몬스터/트레이너 SR 슬롯 분리 — `card_type` 필드 기준. MEGA 계열은 트레이너 SR/SAR 슬롯 1개와 포켓몬 SR/SAR/MUR 슬롯 1개를 분리해 한 박스에서 트레이너 고레어가 2장 나오지 않게 한다. 일반 SV 확장팩의 UR은 트레이너/에너지 UR도 존재하므로 전체 UR 풀을 사용한다. card_type 미분류 시 전체 풀 폴백.
- **D-145** MEGA 확장팩 포켓몬 SR/SAR/MUR 슬롯 가중치 — pokemon-infomation.com + Samurai Sword Tokyo (2026-05) 실데이터 기반. 현재 MEGA 확장팩 공통 모델은 포켓몬 메인 슬롯 SR 70% / SAR 28% / MUR 2% + 추가 포켓몬 SR 슬롯 약 10%.
- **D-146** 추가 SR/SR+ 슬롯 모델 — SV 일반/MEGA 확장팩/블랙볼트·화이트플레어 모두 2장 이상 박스 가능성을 반영한다. SV 일반은 추가 SR 약 10%(트리플렛비트 5%), MEGA 확장은 추가 포켓몬 SR 약 10%, SV11 계열은 추가 SR 약 10%로 둔다. 한국판 공식 봉입률은 비공개이므로 실데이터 확보 시 갱신.
- **D-147** 박스→박스 1.8초 트랜지션 연출 — `/loading.gif`, `/loading2.gif` 번갈아 노출. 팩→팩은 즉시 (트랜지션 X).
- **D-148** 일본판 데이터 보강 파이프라인 — 한국 발매 직후 pokemoncard.co.kr 미업로드 카드는 yuyu-tei + PokeGuardian으로 임시 보강. MUR/HR rarity → 'UR'로 정규화.
- **D-149** 인페르노X / 메가브레이브 / 메가심포니아 세트 추가 — 일본판 데이터 기반 (D-148 파이프라인 활용).

---

## 16. 로드맵 (의존성 그래프)

### 의존성 그래프

```
[D] 인프라 셋업 (간소화 — MVP 필요한 것만)
  ↓
[D] 카드 데이터 수집 (1세트, JSON)
  ↓
[★ MVP] 정적 사이트로 박스 시뮬 + 첫 배포
  ↓ 사용자 100명 누적
  ↓
========== Stage A: 백엔드 첫 등장 ==========
[F1] 글로벌 통계 — [F2] 럭 점수 — [F3] 공유 링크
   (Redis만)         (정적 분포)    (Redis TTL)
  ↓ 사용자 1000명 또는 리뷰 요구
  ↓
========== Stage B: Postgres 등장 ==========
[F4] OAuth (구글) → [F5] 카드 리뷰 → [F6] 랭킹 페이지
                       (Postgres)      (Postgres)
  ↓
========== Stage C: 외부 데이터 ==========
[F7] 시세 (보조)
  
[F8] 홀로 효과 (독립적, 어느 시점이든)
                                
========== Stage D: 운영 ==========
[P] CI/CD, Sentry, 분석, 라이브 카운터
[P] 폴리싱 (README, ADR, 정책 페이지)
```

### MVP 직전까지 (D 단계, 순차)

#### D1. 인프라 셋업 (간소화)

**MVP에 필요한 것만**
- [ ] GitHub 레포 (`pokesim-kr`, public) — `frontend/`, `data/`, `docs/`
- [ ] **GitHub branch protection ON** (D-134) — main 직접 push 금지, PR 머지만
- [ ] Cloudflare 계정 + Workers (Static Assets), R2 셋업
- [ ] 로컬: Node 22 LTS, pnpm (Node 20 LTS는 2026-04 EOL이라 22 채택)
- [ ] AGENTS.md 커밋

**나중에 (Stage A)**: Fly.io, Upstash
**나중에 (Stage B)**: Neon, Python 3.12 + uv, Docker

#### D2. 카드 데이터 수집 (다중 세트, D-139)

**참고**: [12. 데이터 정책](#12-데이터-정책) 준수, 모든 확률에 출처 메타.

- [x] **시작 라인업 확정** — `MEGA 확장팩 「닌자스피너」` / `MEGA 하이클래스팩 「MEGA 드림 ex」` / `MEGA 확장팩 「니힐제로」` / `MEGA 확장팩 「블랙볼트」` (한국판 현재 발매 중)
- [ ] 카드 메타 SSOT: **pokemoncard.co.kr** (D-038 정합)
- [ ] JSON 스키마 설계 (다중 세트 + 출처 메타, 신상 추가 시 재사용)
- [ ] 카드 메타 자동 수집 스크립트 (`scripts/fetch-pokemoncard.ts`) — 번호, 이름(한국어), 레어도, 이미지 URL, 영문/일본판 매칭 ID
- [ ] 팩 슬롯 확률표 — 커뮤니티 합의(P2) + 출처 메타. 단일 인증글 X.
- [ ] **박스 정보**:
  - box_size (보통 30), pack_size (보통 5)
  - box_price_krw, pack_price_krw
  - box_guarantees (추정치, 출처 메타 필수)
- [ ] **저장 (1차)**: `data/sets/{code}.json` + `data/sets-index.json` (다중 세트 인덱스). 스키마: `data/schemas/set.schema.json`
- [ ] **저장 (배포)**: MVP 진입 시 빌드 스텝으로 `frontend/public/sets/{code}.json`에 복사 (단일 SoT는 `data/`)
- [ ] 카드 이미지 R2 (`pokesim-kr-cards`) 업로드

### ★ MVP 첫 배포 (정적 사이트)

**무조건 띄운다. 백엔드 없음. Cloudflare Workers (Static Assets)만.**

- [ ] Next.js 프로젝트 init (App Router + TS)
- [ ] 메인 페이지: 세트 목록 (정적 JSON)
- [ ] 세트 페이지: "박스 까기" (메인) + "1팩만" (옵션)
- [ ] **시뮬 화면 컨셉: 담백하게** ([14. 시뮬 화면 원칙](#14-시뮬-화면-원칙))
  - 얼마 썼나 (박스 가격 165,000원)
  - 얼마 얻었나 (레어도별 카운트)
  - 컬렉션 가치는 Stage C 후
- [ ] **박스 시뮬 로직** (`lib/simulator.ts`)
  - `simulateBox()`: 30팩 보장 슬롯 + 가중치 추첨
  - `simulatePack()`: 단일 팩 (옵션 모드)
- [ ] 카드 컴포넌트 + 펼침 애니메이션 (홀로 효과 X)
- [ ] **순차 팩 펼침 + 건너뛰기**
- [ ] 푸터 데이터 출처 디스클레이머
- [ ] Cloudflare Workers 배포 (`wrangler deploy`)
- [ ] 친구 1명한테 보여주기

**MVP에 절대 안 들어가는 것**: 백엔드 일체, 통계, 럭 점수, 공유, 시세, 리뷰, 홀로 효과, OAuth, 다크모드, 대량 시뮬

### Stage A: 백엔드 첫 도입 (Redis만)

**진입 트리거**: 사용자 100명 누적

#### F1. 글로벌 통계

- [ ] FastAPI 프로젝트 init (`backend/` 신규, SQLAlchemy 아직 X)
- [ ] Fly.io 배포
- [ ] Upstash Redis 연동
- [ ] `POST /api/v1/stats/record` (HINCRBY)
- [ ] `GET /api/v1/stats/sets/{code}` (Redis 조회)
- [ ] 메인 페이지 라이브 카운터
- [ ] Rate limit (IP당 분당 100, Redis Sorted Set)
- [ ] 시간당 flush 잡 — Redis HASH 누적 (Postgres 없음)

#### F2. 럭 점수 + 백분위

**의존**: MVP만 (백엔드 없어도 됨)

- [ ] `scripts/build-distributions.ts`: 박스 100만 번 + 팩 100만 번
- [ ] `frontend/public/distributions/{set_code}_box.json` + `_pack.json`
- [ ] 클라이언트 `lib/luck.ts`
- [ ] 점수 = -log10(p) 합산
- [ ] 백분위 = 분포 이진 검색
- [ ] **결과 화면에 작게 표시** (잔장식)

#### F3. 공유 링크 + OG 이미지

**저장**: Redis TTL 7일 (Postgres 아직 X)

- [ ] `POST /api/v1/shares` (nanoid, Redis SET)
- [ ] `GET /api/v1/shares/{id}`
- [ ] `/share/[id]` 프론트
- [ ] 동적 OG 이미지 (`opengraph-image.tsx`)
- [ ] 만료 share는 Redis TTL 자동 처리
- [ ] 카톡/트위터 미리보기 확인

### Stage B: Postgres 등장

**진입 트리거**: 사용자 1,000명 누적 또는 리뷰 요청

#### Stage B 진입 시 마이그레이션

- [ ] Neon Postgres 인스턴스 생성
- [ ] SQLAlchemy / Alembic 백엔드 추가
- [ ] DB 스키마 마이그레이션 (sets, cards, rarities, pack_slots)
- [ ] 정적 JSON → Postgres seed (한 번만)
- [ ] **F1 통계 (Redis HASH) → Postgres `pull_stats_hourly`로 누적 마이그레이션**

**안전 가드**
- 정적 JSON 백업 유지
- Redis 데이터는 손실해도 통계 카운트만 영향 (사용자 데이터 X)
- 한 단계씩 검증

#### F4. OAuth (구글)

- [ ] Google Cloud Console: OAuth 앱 등록
- [ ] DB: `users`, `sessions`
- [ ] `/api/v1/auth/google/start` (state + PKCE)
- [ ] `/api/v1/auth/google/callback`
- [ ] 세션 미들웨어 (Redis 우선 + DB fallback)
- [ ] `/api/v1/auth/me`, `/logout`, `/account`
- [ ] 만료 세션 정리 cron
- [ ] 프론트 로그인 모달

**보안 체크**: state CSRF, PKCE, HttpOnly+Secure+SameSite=Lax, 시크릿 안전

#### F5. 카드 리뷰 시스템

- [ ] DB: `rating_tags`, `card_ratings`, `card_rating_tags`, `card_comments`, `card_rating_summary`
- [ ] 시드: 미리 정의 태그 30개
- [ ] `POST /api/v1/cards/{id}/ratings` (2축, UPSERT)
- [ ] `POST /api/v1/cards/{id}/comments` (50자)
- [ ] `POST /api/v1/comments/{id}/flag` (신고)
- [ ] Rate limit: 사용자당 일일 코멘트 5건
- [ ] `GET /api/v1/cards/{id}/reviews` (캐시 1분)
- [ ] 리뷰 요약 재계산 cron (1시간)
- [ ] 프론트 리뷰 섹션 + 작성 모달
- [ ] 시드 리뷰 작성 (50~100장)

#### F6. 랭킹 페이지

- [ ] `GET /api/v1/rankings/by-art` (rating_count >= 5)
- [ ] `GET /api/v1/rankings/by-collection`
- [ ] `GET /api/v1/rankings/by-tag/{code}`
- [ ] `/rankings` 프론트 페이지

### Stage C: 외부 데이터 통합

#### F7. 시세 (보조)

- [ ] PokemonTCG.io API 연동
- [ ] 환율 fetch + 매일 04:00 KST cron
- [ ] DB: `price_external`, `price_summary`
- [ ] `GET /api/v1/prices/cards/{id}`
- [ ] 카드 디테일 가볍게 ("해외 참고가" 라벨)
- [ ] **차별화 X** (D-031)

### 독립 기능

#### F8. 홀로그래픽 효과

**의존**: MVP만. 어느 시점이든 가능.

- [ ] 레어도별 효과 (R, RR, SR, SAR, UR, AR)
- [ ] 마우스 틸트 + 홀로 그라데이션
- [ ] 글리터 + 스파클
- [ ] 모바일 자이로 (옵션)
- [ ] `prefers-reduced-motion`

### Stage D: 운영 + 폴리싱

#### P1. 운영 인프라

- [ ] CI/CD (PR: lint/typecheck/test, main: 자동 배포)
- [ ] 핵심 로직 테스트 (시뮬, 통계, 럭 점수, 리뷰)
- [ ] Sentry (FE + BE)
- [ ] UptimeRobot 헬스체크
- [ ] Cloudflare Web Analytics
- [ ] 라이브 카운터 메인 노출

#### P2. 폴리싱

- [ ] Lighthouse 90+
- [ ] 다크 모드
- [ ] 모바일 반응형
- [ ] 접근성 (a11y)
- [ ] 추가 세트 1~2개 (선택)

#### P3. 포트폴리오 작업

- [ ] **README** (스크린샷, 데모, 아키텍처, 점진적 도입 강조)
- [ ] **ADR 10~15개** (`docs/adr/`)
- [ ] **블로그 글 4~5개**
- [ ] **개인정보처리방침 + 이용약관**
- [ ] **운영 지표 README 박제**

### 우선순위 매트릭스 (자르기)

**절대 자르지 말 것**
- D 전체, ★ MVP, F1, F2, F4, F5, F8 일부 (R, RR), P3

**자르기 쉬운 것**
- F3 OG 이미지 → 정적 이미지
- F6 랭킹 일부 → 메인 1개만
- F7 시세 → 통째로
- F8 모바일 자이로
- P2 다크 모드
- P2 추가 세트

### 막힘 우회 가이드

| 막힌 기능 | 우회 가능 |
|----------|---------|
| OAuth | F1, F2, F3, F8 |
| 럭 점수 분포 | F1, F8 |
| Postgres 마이그레이션 | F8, P 단계 |
| 시세 API 매칭 | 다른 거 다 |
| 홀로 효과 | 다른 거 다 |
| 리뷰 어뷰징 방어 | F1, F2, F3, F8, P 단계 |

---

## 17. 코딩 컨벤션

### 폴더 구조 (frontend)

Next.js App Router 표준 구조.

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router (페이지)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # 메인 페이지
│   │   ├── sets/[code]/
│   │   │   └── page.tsx        # 세트 상세
│   │   └── share/[id]/
│   │       └── page.tsx        # 공유 결과
│   ├── components/             # React 컴포넌트
│   │   ├── card.tsx
│   │   ├── pack-opener.tsx
│   │   └── ui/                 # 재사용 UI (버튼, 모달)
│   ├── lib/                    # 비즈니스 로직, 유틸
│   │   ├── simulator.ts        # 박스 시뮬
│   │   ├── luck.ts             # 럭 점수
│   │   └── utils.ts
│   ├── types/                  # 타입 정의
│   │   ├── card.ts
│   │   └── set.ts
│   ├── hooks/                  # 커스텀 훅
│   │   └── use-pack-opener.ts
│   └── styles/
│       └── globals.css
├── public/                     # 정적 자산
│   ├── sets/{code}.json
│   ├── distributions/{code}_box.json
│   └── distributions/{code}_pack.json
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

### 폴더 구조 (backend, Stage A 진입 시)

```
backend/
├── app/
│   ├── main.py                 # FastAPI 진입점
│   ├── config.py               # pydantic-settings
│   ├── deps.py                 # DI
│   ├── api/v1/
│   │   ├── auth.py
│   │   ├── sets.py
│   │   ├── stats.py
│   │   ├── shares.py
│   │   └── reviews.py
│   ├── db/                     # Stage B+
│   │   ├── models.py
│   │   ├── session.py
│   │   └── repositories/
│   ├── services/
│   ├── core/
│   │   ├── cache.py
│   │   ├── ratelimit.py
│   │   └── logging.py
│   └── schemas/                # Pydantic
├── alembic/                    # Stage B+
├── tests/
├── pyproject.toml
└── Dockerfile
```

### 명명 규칙 (언어별 관습 따르기)

**파일명**: 둘 다 소문자 + 케밥/snake (전 세계 표준)
- TypeScript: `card.tsx`, `pack-opener.tsx`, `simulator.ts`
- Python: `simulator.py`, `auth_service.py`

**함수/변수**:
- TypeScript: `camelCase` — `simulateBox()`, `userId`, `cardData`
- Python: `snake_case` — `simulate_box()`, `user_id`, `card_data`

**컴포넌트/클래스**: `PascalCase` (양쪽 다)
- React 컴포넌트: `Card`, `PackOpener`
- Python 클래스: `UserService`, `RatingRepository`

**상수**: `UPPER_SNAKE_CASE` (양쪽 다)
- `MAX_PACK_SIZE`, `BOX_SIZE`, `GOD_PACK_PROBABILITY`

**타입 정의 (TypeScript)**: `PascalCase`
- `interface Card { ... }`, `type RarityCode = ...`

### 커밋 메시지 (Conventional Commits)

형식:
```
<type>: <한국어 설명>

[선택: 본문 — 왜 이렇게 했는지]
```

**type 종류**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경 (코드 X)
- `style`: 포맷팅 (동작 변화 없음)
- `refactor`: 리팩토링
- `test`: 테스트
- `chore`: 빌드, 설정, 잡일

**예시**:
```
feat: 박스 시뮬 알고리즘 구현
fix: 럭 점수 음수 처리 버그
docs: AGENTS.md 코딩 컨벤션 추가
chore: tailwind 설정 추가
refactor: simulator를 box/pack 함수로 분리
feat(auth): 구글 OAuth 콜백 처리
```

**버전 표시는 git tag로**:
```bash
git tag v1.0.0  # MVP 배포 시
git tag v1.1.0  # F1 배포 시
```

### 브랜치 전략

**1인 개발 단순화**:
- `main` — 프로덕션 (Cloudflare Workers 자동 배포)
- 기능 작업: `feat/box-simulator` 같은 브랜치 만들고 PR
- PR 머지 시 자동 배포

main 직접 push 안 함 (실수 방지).

### ESLint / Prettier

**기본 설정 따라가기**. Next.js init이 자동 셋업.

추가 설정 (필요 시):
- ESLint: `next/core-web-vitals` 기본 + 커스텀 규칙은 만들지 말 것
- Prettier: 기본 설정 (탭 2칸, 세미콜론 사용, 따옴표 single)

세부 규칙 정해두기:
- 임포트 순서: 자동 정렬 (eslint-plugin-import)
- 사용 안 하는 import: 자동 제거
- 컴포넌트는 named export 또는 default export 일관 (default 추천 — Next.js 페이지 강제)

### 시뮬 알고리즘 세부

매우 중요. AI가 코딩할 때 이 섹션 그대로 따라야 함.

**박스 시뮬 흐름**:
```
1. 시드 생성 (Date.now() + Math.random())
2. 시드 기반 PRNG 초기화 (seedrandom 라이브러리)
3. 박스 보장 슬롯 위치 결정:
   - 보장 룰 (RR 6개, SR 1개 등)을 30팩 중 랜덤 위치에 배치
   - 한 팩에 여러 보장 가능 (예: 3번 팩에 RR + SR)
4. 갓팩 판정:
   - 1% 확률로 갓팩 발생 (커뮤니티 추정)
   - 갓팩이면 30팩 중 1팩 랜덤 선택
   - 그 팩의 모든 슬롯 가중치를 상위 레어도로 시프트
5. 30팩 순회:
   - 각 슬롯에 대해:
     a. 보장 슬롯이면 보장 레어도로 강제
     b. 갓팩이면 부스트된 가중치로 추첨
     c. 일반 팩이면 기본 가중치로 추첨
   - 추첨 후 해당 레어도 풀에서 카드 1장 선택 (중복 허용)
6. Fisher-Yates 셔플로 결과 섞기
7. 결과 + 시드 반환
```

**1팩 모드**:
- 박스 보장 룰 무시
- 갓팩 판정 없음 (박스 단위 메커니즘이라)
- 단순 가중치 추첨만

**중복 허용**:
- 한 박스에 같은 SR 두 장 가능
- 한 팩에도 같은 카드 두 장 가능 (드물지만 확률상 가능)

**시드 시스템**:
- 라이브러리: `seedrandom` (npm)
- 시드 형식: 문자열 (예: `"1730000000-abc123"`)
- 공유 시 시드 함께 저장 → 검증 가능
- 시드 길이: 16자 정도

**갓팩 메커니즘**:
- 박스당 1% 확률 발생 (커뮤니티 추정, 출처 메타 필수)
- 발생 시 30팩 중 1팩 랜덤 선택
- 해당 팩의 가중치 시프트:
  - RR/SR/SAR 가중치 ×5
  - C/U 가중치 ×0.1
- 갓팩 결과는 별도 플래그 (`isGodPack: true`) → UI에서 시각적 강조

### UI/UX 규칙 (미정 — MVP 작업하면서 결정)

다음은 D1 끝나고 MVP 작업 시작할 때 결정:
- 사이트 분위기 (다크/라이트, 색감)
- 폰트 (Pretendard? 시스템 폰트?)
- 로고/아이콘
- 박스 펼침 애니메이션 속도
- 결과 화면 카드 그리드 레이아웃
- 손익 표시 방식 (이모지? 색깔?)

미리 정해도 구현 시 거의 다 바뀜. 코딩하면서 결정.

### 안전 규칙 / 변경 되돌리기

잘못된 변경이 쌓여서 덮여 사라지지 않도록, "사후 복구 가능한" 작업 흐름을 강제한다.
1인 개발이라 본인이 마지막 안전망 — 실수 = 본인 손해.

#### 변경 단위 / 박제

- **D-132** 작업 단위는 작게, 커밋 자주. 한 커밋 = 한 의도. 큰 변경 한 방에 커밋 X.
  잘못되면 한 단위씩 `git revert <hash>`로 되돌리기 가능.
- **D-133** AI 어시스턴트(Claude/Cursor) 변경은 **받은 즉시 검토 + 커밋해서 박제**.
  다음 수정이 잘못 가도 직전 커밋(직전 AI 결과)으로 즉시 복귀 가능. AI 응답 위에
  AI 응답을 덮어쓰지 말 것.

#### 브랜치 / 머지 보호

- **D-134** main 브랜치는 GitHub branch protection ON. 직접 push 금지, PR 머지만 허용.
  D-124의 "main 직접 push 안 함" 규칙의 자동 강제 버전. 1인이라도 의무화 — 실수 방지.
- **D-135** 위험한 git 명령(`reset --hard`, `push --force`, `rebase`) 사용 전 항상
  `git branch backup/<날짜>` 백업 브랜치 생성. 작업 끝나고 멀쩡하면 백업 브랜치 제거.

#### 인프라 / 시크릿

- **D-136** 인프라 / 시크릿 변경은 git에 흔적을 남긴다. Cloudflare/Fly.io 콘솔에서
  수동 변경 X. 설정은 코드(wrangler.toml, fly.toml, .env.example 등)로 관리.
  콘솔에서 일시적으로 만진 게 있으면 곧바로 코드에 반영하고 커밋.

#### 외부 호출 / 부작용

- **D-137** 외부 API 호출은 dev/staging 분리 또는 dry-run 모드 우선. OAuth, 결제,
  시세 fetch, 통계 record 등이 프로덕션 데이터 손상시키지 않게 격리.
  로컬 .env에 staging 키 박아두고, 프로덕션 키는 Cloudflare/Fly.io 시크릿에만.

#### 롤백 시나리오

- **D-138** 배포 실패 시 복구 절차를 미리 박제:
  1. `git revert <문제 커밋>` → push → Cloudflare Workers 재배포 (자동)
  2. 또는 Cloudflare Workers 콘솔에서 직전 정상 deployment "Rollback" 버튼
  3. DB는 backward-compatible 보장(D-012)이라 코드만 되돌리면 정상 복구

#### 매일 가드 (1인 개발자용)

- 작업 끝나면 `git push origin <branch>` 또는 PR 머지로 GitHub에 동기화.
  로컬만 있으면 디스크 사고 시 전부 소실.
- 새 작업 전 `git status`로 작업 영역 깨끗한지 확인. dirty면 stash 또는 커밋 후 시작.
- "이거 되돌릴 수 있나?" 의문 들면 **먼저 멈추고 백업 브랜치 만들기**.

---

## 18. 현재 작업 단계

```
현재: ★ MVP 완성, 배포 직전
브랜치: feat/jp-data-augment (미머지, PR 준비 중)

완료된 작업 (D1 ~ MVP):
  - D1: 인프라 셋업 (GitHub + CF Workers + R2 + Node 22 + pnpm)
  - D2: 카드 데이터 수집 스크립트 (pokemoncard.co.kr reverse engineering)
  - MVP: Next.js 15 App Router + TypeScript + Tailwind CSS + seedrandom
    · SetPicker: 세트 선택 화면 (카드 박스 이미지, 그라데이션 폴백)
    · BoxSimulator: 4가지 모드 — 자동 / 수동 / 즉시 / 1팩
    · 박스 보장 로직: 몬스터 SR이상 ×1 + 트레이너 SR이상 ×1 + AR ×3 (card_type 분리)
    · 세트별 SAR 봉입률 (D-145, D-146)
    · 카드 모달 (CardModal.tsx), MUR 표시 라벨 (D-143)
    · 박스 결과 토글 필터 (등급별 on/off)
    · 세션 누적 localStorage 영속화 (D-142)
    · 박스→박스 1.8초 트랜지션 연출

세트 데이터 현황 (모두 `data/sets/` + `frontend/public/sets/`):
  - m4-ninja-spinner:   120장 (정규 83 + 일본판 임시 37)
  - m-nihil-zero:       117장
  - m-dream-ex:         250장 (하이클래스)
  - m-inferno-x:        NEW (일본판 데이터 보강)
  - m-mega-brave:       NEW (일본판 데이터 보강)
  - m-mega-symphonia:   NEW (일본판 데이터 보강)

다음 작업 (우선순위):
  1. feat/jp-data-augment 커밋 정리 + PR + main 머지
  2. 배포: wrangler.toml 작성 → wrangler deploy (CF Workers)
     또는 Vercel로 빠르게 먼저 띄워서 친구 테스트
  3. MUR/HR 카드 고화질 업그레이드 (yuyu-tei 썸네일 → PokeGuardian 고화질)
  4. 봉입률 튜닝 (사용자 데이터 누적 후)
  5. 카드 이미지 R2 마이그레이션 (외부 hotlink 안정화 후)
  6. Stage A 트리거: 사용자 100명 → FastAPI + Redis

사용자 누적: 0 (배포 전)
```

---

## 19. 흔한 실패 패턴

피해야 할 것:

1. ❌ MVP에 차별화 기능 다 욱여넣기 (시뮬 담백, 백엔드 없음)
2. ❌ 한 기능에 며칠 막혔는데 우회 안 함
3. ❌ DB 스키마 과설계 (지금 안 쓸 컬럼 X)
4. ❌ README를 마지막에 한 번에 쓰기 — 매주 갱신
5. ❌ 새 기능 떠오를 때마다 추가 (VISION 또는 비목표 확인)
6. ❌ 럭 점수, 리뷰 강조하면서 시뮬 화면 복잡해지기 (D-090)
7. ❌ Stage A에서 미리 Postgres 띄우기 (트리거 도달 전 X)
8. ❌ MVP가 정적이라 사용자 안 모이면 못 넘어감 — 트리거 못 도달하면 마케팅 집중
9. ❌ 0주차에 도구 셋업하다 일주일 날림
10. ❌ 1주차 데이터 수집을 너무 완벽하게
11. ❌ 4주차에 디자인 욕심
12. ❌ 4주차 전에 홀로 효과 손대기

---

## 20. 변경 이력

이 파일을 수정할 때마다 한 줄 추가.

- 2025-04-28 — 초기 작성 (8개 문서 통합, AGENTS.md 단일 SSOT 채택)
- 2025-04-28 — **코딩 컨벤션 결정 (D-120~D-131). 17번 섹션 채움. 갓팩 메커니즘 도입.**
- 2026-04-29 — D1 인프라 셋업 시작. 로컬 폴더 구조 + .gitignore + .gitattributes + 루트 README(포폴용) + git init + 첫 커밋. 18절 갱신.
- 2026-04-30 — Node 런타임을 22 LTS로 확정 (20 LTS EOL 회피). 16절 D1 체크리스트 + README 개발 절 동기화.
- 2026-04-30 — 안전 규칙 / 변경 되돌리기 7개(D-132~D-138) 추가. 17절 서브섹션 신설, 15절 인덱스 카테고리 추가, 16절 D1 체크리스트에 branch protection 항목 포함, Node 22 설치 완료 반영.
- 2026-04-30 — **D-002 변경: Cloudflare Pages → Workers (Static Assets).** 2026 Cloudflare가 신규 Pages 생성을 Workers로 일원화. 정적 자산 대역폭 무제한 무료(Pages와 동등), `wrangler.toml`로 D-136과 정합, F3 OG 이미지 등 향후 함수 작업 일관성 ↑. 6, 7, 8, 9, 11, 15(D-138), 16, 17, 18절 동기화. GitHub 레포 생성 + origin remote 연결 반영.
- 2026-04-30 — D1 외부 작업 완료 박제: Cloudflare Workers `pokesim-kr` 프로젝트 GitHub 연결 + R2 버킷 `pokesim-kr-cards` 생성 (Standard, APAC). 18절 중복 "대기 (외부 작업)" 섹션 제거 (D-002 PR 시 누락된 정리). 다음 D2 진입.
- 2026-04-30 — **D2 진입 + 카드몬스터 모순 정리.** 1절 참고 사이트에서 카드몬스터 → pokemoncard.co.kr로 교체 (한국판 카드 메타 SSOT). 12절 P2 출처에서 카드몬스터 제거 + "커뮤니티 합의(메인)" 명세, 단일 인증글/단일 사용자 결과는 편향이라 메인 X 박제. D-038 코멘트 보강. **D-139 신설** (D2 다중 세트 동시 시작 — 닌자스피너/MEGA 드림 ex/니힐제로/블랙볼트). 16절 D2 체크리스트 갱신. 18절 D2 진입 반영.
- 2026-04-30 — D2 스키마 + 닌자스피너 sample 작성. `data/schemas/set.schema.json` (Draft-07, 출처 메타 필수), `data/sets-index.json` (active/planned), `data/sets/m4-ninja-spinner.json` (M4=닌자스피너 매핑 검증, 카드 1장만 채움). 16절 D2 데이터 위치 박제: 1차는 `data/sets/`, 빌드 스텝으로 `frontend/public/sets/` 복사. 18절 진행 상태 + pokemoncard.co.kr reverse engineering 결과 반영.
- 2026-05-xx — **박스깡 시뮬레이터 MVP 구현 (PR #6 merged).** SetPicker + BoxSimulator 4가지 모드 + 카드 모달 + MUR 표시. 박스 보장 로직(AR×3, SR×2 슬롯), 세션 누적, 박스→박스 트랜지션, 결과 토글 필터.
- 2026-05-xx — **일본판 데이터 보강 파이프라인 구축 (feat/jp-data-augment).** yuyu-tei + PokeGuardian 자동 수집 스크립트. 닌자스피너 비정규 37장 보강 (120장 완비).
- 2026-05-xx — **봉입률 로직 고도화.** 몬스터/트레이너 슬롯 card_type 분리 (D-144). MEGA 확장팩 SAR 28% / MUR 2% 모델 및 추가 SR 슬롯 실데이터 적용 (D-145, D-146).
- 2026-05-xx — **인페르노X / 메가브레이브 / 메가심포니아 세트 추가 (D-149).** 일본판 데이터 보강 파이프라인으로 수집.
- 2026-05-07 — **D-140~D-149 결정 박제. 18절 현재 상태 갱신 (MVP 완성, 배포 직전). 코드 정리 (중복 sort 제거, D-NNN 사용자 노출 문자열 정리, 인라인 코멘트 정리).**

### 통합 전 8개 문서 변경 이력 (보존)

- 2025-04-28 — README/ARCHITECTURE/ROADMAP/DECISIONS 초기 작성
- 2025-04-28 — 차별화 포인트 5,6,7 추가 (럭 점수, 확률 비교, 공유)
- 2025-04-28 — 데이터 정책 + DATA_SOURCES.md, 차별화 #8 (투명성)
- 2025-04-28 — 시세 차별화 → 보조. 카드 리뷰 + 랭킹 추가
- 2025-04-28 — 로그인 비목표 → 부분 도입. ACCESS_CONTROL.md. 구글 OAuth
- 2025-04-28 — 시뮬 담백 원칙. ROADMAP 의존성 그래프. VISION.md
- 2025-04-28 — 목표 4개 병행. 차별화 사용자 임팩트 순
- 2025-04-28 — 박스 단위 시뮬 메인 (D-037 폐기). 팩 옵션
- 2025-04-28 — 점진적 백엔드 도입. MVP 정적, Stage A~D
- 2025-04-28 — **8개 문서 → AGENTS.md 통합 (단일 SSOT)**

---

## 부록: 새 결정 추가 가이드

새 결정을 할 때:

1. **ID 부여** (다음 번호, [15. 의사결정 인덱스](#15-의사결정-인덱스))
2. **한 줄 요약 작성**
3. 5문장 이상 설명이 필요하면 `docs/adr/NNNN-제목.md` 별도 작성
4. **충돌 체크**:
   - 비목표와 충돌하는가? (3절)
   - 데이터 정책에 부합하는가? (12절)
   - 접근 제어 정책 영향? (13절)
   - 로드맵에 추가할까? (16절)
5. **충돌하면 해당 섹션도 같이 갱신**
6. **변경 이력에 한 줄 추가** (20절)
