# Supabase 분석 DB 비용 최적화

PokéSim KR의 익명 분석 이벤트가 빠르게 누적되면서 Supabase Free Plan의 500MB
데이터베이스 한도를 초과했다. 단순히 데이터를 삭제하거나 유료 플랜으로 전환하지 않고,
분석에 필요한 정보는 보존하면서 원본 이벤트와 인덱스의 크기를 제한하는 구조로 개선했다.

## 문제 상황

2026년 7월 12일 기준 약 197만 건의 이벤트가 두 개의 append-only 테이블에 쌓였다.

| 항목 | 측정값 |
| --- | ---: |
| 전체 DB 크기 | 953MB |
| `user_events` | 543MB (테이블 197MB + 인덱스 346MB) |
| `sim_events` | 399MB (테이블 130MB + 인덱스 268MB) |
| Supabase Free Plan DB 한도 | 500MB |

원본 행보다 인덱스가 더 컸고, 일부 복합 B-tree 인덱스는 생성 이후 조회 횟수가
0~수십 회에 불과했다. 반면 일별 통계와 세트 인기도 조회에 쓰이는 인덱스는 수만 회
사용되고 있었다.

## 목표

1. Free Plan 안에서 운영 가능한 여유 공간을 확보한다.
2. 누적 박스·팩 수, DAU, D1/D7 리텐션은 장기 보존한다.
3. 최근 퍼널과 유입 분석에 필요한 원본 이벤트는 유지한다.
4. 정리 작업이 사용자 요청 경로에 영향을 주지 않도록 자동화한다.

## 진단

`pg_stat_user_tables`, `pg_stat_user_indexes`, `pg_relation_size`를 이용해 테이블과
인덱스별 크기 및 `idx_scan`을 함께 확인했다.

제거 대상으로 판단한 인덱스는 다음 조건을 모두 만족했다.

- 크기가 크고 실제 스캔 횟수가 매우 적다.
- 현재 운영 쿼리가 동일한 조회 패턴을 사용하지 않는다.
- 기본 키나 RLS 동작에 필요한 인덱스가 아니다.
- 제거 후에도 자주 실행되는 통계 쿼리의 인덱스는 유지된다.

append-only 시간 조회에는 43MB B-tree 대신 24KB BRIN 인덱스를 두었다. BRIN은
정확한 단건 탐색에는 부적합하지만, `created_at`이 대체로 삽입 순서대로 증가하는 이벤트
테이블의 기간 조회에는 공간 대비 효율이 좋다.

## 해결 구조

```txt
브라우저 이벤트
  ├─ user_events: 최근 30일 원본
  │    ├─ analytics_visitors: 방문자별 최초/최근 방문
  │    └─ analytics_user_daily_activity: 방문자별 하루 1행
  │
  └─ sim_events: 최근 14일 원본
       ├─ analytics_sim_archive: 누적 세션/박스/팩/금액
       ├─ analytics_sim_daily: 날짜별 합계
       └─ analytics_sim_daily_sessions: 세션별 하루 1행

Supabase Cron (매일 03:20 KST)
  → 집계 완료 확인
  → 보존 기간이 지난 원본 삭제
```

### 1. 인덱스 예산 관리

- 사용되지 않는 대형 복합 인덱스 7개를 제거했다.
- 실제 조회가 많은 세트 인기도, 생성일, 세션 인덱스와 기본 키는 유지했다.
- `user_events.created_at` 기간 조회는 소형 BRIN 인덱스로 대체했다.

### 2. 원본과 분석용 데이터 분리

원본 이벤트는 디버깅과 세부 퍼널 분석에 필요하지만 영구 보존할 필요는 없다.

- `sim_events`: 14일 보존
- `user_events`: 30일 보존
- 퍼널·유입 상세: 최근 30일 분석
- 누적 통계와 날짜별 핵심 지표: 영구 보존

DAU와 리텐션은 이벤트 전체가 아니라 `(day_kst, visitor_id)` 조합만 있으면 계산할 수
있다. 동일 방문자가 하루에 여러 이벤트를 보내도 기본 키 충돌 처리로 한 행만 남긴다.
시뮬 세션도 같은 방식으로 `(day_kst, session_id)` 한 행만 저장한다.

### 3. 데이터 손실 없는 정리 순서

마이그레이션은 다음 순서를 보장한다.

1. 기존 원본에서 방문자·세션별 일일 활동을 백필한다.
2. 앞으로 들어오는 이벤트를 트리거로 일일 집계에 반영한다.
3. 누적 합계와 일일 집계가 만들어진 후에만 오래된 원본을 삭제한다.
4. 대량 삭제 후 필요할 때만 `VACUUM FULL`로 물리 공간을 회수한다.

`VACUUM FULL`은 테이블 잠금을 유발하므로 Cron에 넣지 않고 최초 대량 정리 후 저트래픽
시간대에 한 번씩 실행한다. 이후 일반 삭제 공간은 PostgreSQL이 새 행에 재사용한다.

### 4. 자동화와 접근 제어

- `pg_cron`으로 매일 03:20 KST에 보존 정책을 실행한다.
- 집계 테이블은 RLS를 활성화하고 `anon`, `authenticated`의 직접 접근을 제거했다.
- 트리거 함수는 `SECURITY DEFINER`와 고정된 `search_path`를 사용한다.
- 클라이언트에는 기존의 제한된 통계 RPC만 노출한다.

### 5. 사용자 기록의 고정 용량 백업

로그인 사용자의 개봉 기록과 도감은 카드별·개봉별 행으로 계속 쌓지 않는다. 사용자당
`user_record_backups` 한 행에 기기별 압축 스냅샷을 저장하고 JSON 크기를 64KB로 제한한다.

- 일반 카드, 이미지 URL, 카드 이름과 가격은 저장하지 않는다.
- 세트별 박스·팩 수, 레어도별 수, 힛카드 번호와 도감 획득 수만 저장한다.
- 기본 키 외 JSON 검색 인덱스를 만들지 않는다.
- 로컬 변경은 즉시 반영하되 서버 쓰기는 15초 동안 모아서 한 번에 처리한다.
- `revision` 낙관적 잠금과 기기별 `source_id`로 서로 다른 기기의 기록 덮어쓰기를 막는다.

가입자가 늘어도 사용자당 저장량이 상한을 가지므로 분석 로그처럼 무제한 증가하지 않는다.
DB는 350MB 이하를 운영 목표로 두고 400MB부터 보존 기간과 백업 크기를 다시 점검한다.

### 6. 글로벌 통계 조회 캐시

초기 `get_global_stats()`는 누적 archive에 최근 14일 `sim_events`의 `COUNT(DISTINCT)`와
`SUM`을 더했다. 원본 보존량이 커지자 공개 RPC의 짧은 statement timeout을 간헐적으로
넘어 `500`을 반환했다.

기존 누적값을 `analytics_global_stats` 한 행으로 초기화하고, 이후 `sim_events` INSERT
트리거가 일별 집계와 함께 해당 행을 증가시키도록 변경했다. 초기값 복사와 트리거 교체
동안에는 이벤트 테이블의 쓰기 잠금을 한 트랜잭션 안에서 잡아 전환 경계의 누락을 막는다.
공개 RPC는 RLS로 숨긴 집계 행 하나만 읽으므로 원본 이벤트 수와 무관한 응답 시간을 갖는다.

## 결과

| 지표 | 개선 전 | 개선 후 |
| --- | ---: | ---: |
| SQL 측정 DB 크기 | 953MB | 482MB |
| 회수한 인덱스 공간 | - | 약 471MB |
| DB 크기 감소율 | - | 약 49.4% |
| 원본 보존 | 무기한 | sim 14일 / user 30일 |
| 장기 DAU·리텐션 | 원본 의존 | 소형 일일 집계로 영구 보존 |
| 정리 방식 | 수동 | Supabase Cron 일일 실행 |
| 글로벌 통계 조회 | 최근 원본 전체 집계 | singleton 캐시 1행 조회 |

Free Plan 한도 초과를 해소해 즉시 유료 플랜으로 전환할 필요를 줄였고, 데이터 증가량이
원본 이벤트 수가 아니라 일별 순방문자·세션 수에 비례하도록 바뀌었다.

## 트레이드오프

- 30일이 지난 이벤트별 퍼널·리퍼러 상세는 조회할 수 없다.
- 14일이 지난 개별 시뮬 결과는 조회할 수 없다.
- 장기 DAU·코호트 리텐션·날짜별 시뮬 합계·전체 누적치는 계속 조회할 수 있다.
- BRIN은 단건 조회 성능보다 기간 조회와 저장 공간 효율을 선택한 결정이다.

향후 일일 집계 자체가 커지면 월 단위 파티셔닝이나 월별 rollup을 추가할 수 있지만,
현재 트래픽에서는 복잡도 대비 이점이 작아 도입하지 않았다.

## 운영 파일

- 진단: [`supabase/queries/database-size-audit.sql`](../supabase/queries/database-size-audit.sql)
- 인덱스 정리: [`supabase/migrations/20260712000007_reduce_analytics_indexes.sql`](../supabase/migrations/20260712000007_reduce_analytics_indexes.sql)
- 누적 집계·원본 보존: [`supabase/migrations/20260712000008_rollup_and_retain_analytics.sql`](../supabase/migrations/20260712000008_rollup_and_retain_analytics.sql)
- 일별 지표 보존: [`supabase/migrations/20260712000009_preserve_daily_analytics.sql`](../supabase/migrations/20260712000009_preserve_daily_analytics.sql)
- Cron 등록: [`supabase/queries/schedule-analytics-retention.sql`](../supabase/queries/schedule-analytics-retention.sql)
- 검증: [`supabase/queries/verify-daily-analytics.sql`](../supabase/queries/verify-daily-analytics.sql)
- 글로벌 통계 캐시: [`supabase/migrations/20260715000013_cache_global_stats.sql`](../supabase/migrations/20260715000013_cache_global_stats.sql)
- 글로벌 통계 검증: [`supabase/queries/verify-global-stats-cache.sql`](../supabase/queries/verify-global-stats-cache.sql)

## 면접용 요약

> 익명 분석 이벤트 약 197만 건이 쌓이면서 Supabase Free Plan의 500MB 한도를 넘었습니다.
> 테이블보다 인덱스가 더 큰 것을 `pg_stat_user_indexes`로 확인하고, 실제 사용량이 낮은
> 인덱스 7개를 제거해 DB를 953MB에서 482MB로 줄였습니다. 단순 삭제로 분석 데이터를
> 잃지 않도록 방문자·세션별 일일 rollup과 누적 archive를 설계했고, 원본은 용도에 따라
> 14일과 30일만 유지하도록 `pg_cron`으로 자동화했습니다. 결과적으로 비용을 억제하면서
> DAU와 코호트 리텐션은 장기 보존할 수 있게 했습니다.
