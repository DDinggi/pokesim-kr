# 누적 방문 집계

## 기준과 현재 확인값

2026-09-17 23:51 KST에 운영 Supabase를 읽기 전용으로 조회했다.

| 지표 | 값 | 의미 |
| --- | ---: | --- |
| 누적 방문 브라우저 | 16,507개 | `analytics_visitors`의 서로 다른 `visitor_id` 수 |
| 처음 관측된 방문 | 2026-05-29 00:47 KST | 현재 보존된 방문자 기록의 가장 빠른 `first_seen` |
| 최근 30일 방문 브라우저 | 4,898개 | `last_seen`이 조회 시점 이전 30일 이내인 ID |
| 최근 30일 신규 브라우저 | 4,060개 | `first_seen`이 조회 시점 이전 30일 이내인 ID |
| 기존 메인의 30,686 | 일일 개봉 세션 | `get_global_stats().totalSessions`; 방문자 수가 아님 |

KST 월별 **신규 방문 브라우저**: 2026-05 310개, 06 4,564개, 07 4,430개, 08 5,063개, 09 2,140개(17일 조회 시점까지). 월별 신규 ID의 합계만 누적 ID와 일치한다. 월별 활성 방문자 합계는 재방문이 중복되므로 누적 방문자로 사용하지 않는다.

운영 기간 전체의 *실제 사람 수*는 확정할 수 없다. ID는 브라우저의 `localStorage`에 저장되는 익명 UUID다. 같은 사람의 다른 기기·브라우저, 저장소 삭제, 시크릿 모드는 각각 새 ID로 잡힌다. 반대로 JS/분석 요청 차단, 저장소 접근 실패, Supabase 삽입 실패, 추적 시작 전 접속은 빠질 수 있다. 따라서 포트폴리오에는 `누적 방문자 16,507명`이 아니라 **`2026년 5월 29일부터 누적 방문 브라우저 1.65만 개(익명 ID 기준, 2026-09-17 집계)`** 같은 문구를 쓴다. 실제 서비스 시작일이 이보다 빠르면 그 이전 인원은 현재 DB 값에 포함됐다고 주장하지 않는다.

## 앞으로의 집계

기존 `page_view` 등 `user_events`의 `metadata.visitor_id`를 `capture_analytics_visitor` 트리거가 `analytics_visitors`에 영구 보존한다. 원본 이벤트가 30일 뒤 정리돼도 ID별 최초·최근 방문은 남는다. 공개 `/api/visitor-stats`는 서버 전용 키로 이 테이블의 정확한 행 수와 최초 시각만 읽어 전달하며, 방문자 ID나 키는 브라우저에 전달하지 않는다. 메인 화면은 이 수치와 개봉 일일 세션 수를 별개로 표시한다. Supabase 설정/연결이 없으면 누적 방문 브라우저 표시를 숨긴다.

운영 수치와 월별 신규·최근 30일 활성·기존 일일 세션을 재조회하려면 저장소 루트 `.env`의 `SUPABASE_SECRET_KEY`와 `frontend/.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 있는 로컬에서 `pnpm --dir scripts audit:visitors`를 실행한다. 스크립트는 읽기 전용이며 ID·키를 출력하지 않는다. 별도 DB 마이그레이션은 필요 없다.

Cloudflare Web Analytics의 방문/페이지뷰 정의는 이 ID 지표와 다르므로 합산하지 않는다. 대시보드에서 이전 기간을 볼 수 있어도 과거 누락분을 ID에 더하면 중복 제거가 불가능하다. 공식 설명: [Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/), [지표 정의](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/). Cloudflare 계정 인증이 없는 환경에서는 과거 Cloudflare 원자료를 직접 대조할 수 없다.
