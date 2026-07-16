# PokéSim KR 아키텍처·설계 의도 학습 가이드

이 문서는 현재 구조를 외우는 대신 **왜 이렇게 설계했는지 스스로 설명할 수 있게 만드는
학습용 문서**다. 구현을 읽을 때는 각 장의 질문에 먼저 답해 보고 관련 코드를 확인한다.

## 1. 먼저 설명할 수 있어야 하는 것

학습을 마치면 다음 질문에 답할 수 있어야 한다.

1. 왜 카드 데이터와 시뮬레이션을 서버 DB가 아니라 정적 파일과 브라우저에 뒀는가?
2. 왜 로그인 없이 기록을 쓰다가 사용자가 선택할 때만 계정에 동기화하는가?
3. 사용자 기록을 개봉별 행이 아닌 사용자당 64KB 스냅샷 한 행으로 둔 이유는 무엇인가?
4. RLS와 SECURITY DEFINER RPC를 함께 쓰는 이유는 무엇인가?
5. 197만 건의 이벤트를 지우면서도 DAU와 리텐션을 보존할 수 있었던 이유는 무엇인가?
6. get_global_stats의 전체 스캔을 왜 인덱스 추가가 아니라 쓰기 시 누적 캐시로 바꿨는가?
7. 새 세트 카드가 화면에는 보이지만 시뮬레이션에서 나오지 않는 문제를 어떻게 예방하는가?

## 2. 시스템 컨텍스트

    사용자 브라우저
      |
      | HTML·JS·정적 세트 JSON
      v
    Cloudflare Workers / OpenNext
      |
      +------ 카드 이미지 ------> Cloudflare R2 + img.pokesim.kr
      |
      +------ 익명 이벤트 ------>
      |                          Supabase Postgres
      +------ 기록 백업 RPC ---->  - RLS
      |                          - Auth
      +------ 글로벌 통계 RPC -->  - trigger / rollup / cron
      |
      +------ Google ID token --> Supabase Auth

핵심 경계는 세 가지다.

- **읽기가 크고 거의 변하지 않는 것:** 정적 JSON과 R2 CDN.
- **사용자마다 즉시 반응해야 하는 것:** 브라우저 시뮬레이션과 localStorage.
- **여러 기기에서 공유하거나 장기 집계해야 하는 것:** Supabase Auth·Postgres·RPC.

별도 API 서버는 없다. 브라우저가 Supabase Data API를 직접 사용하므로, 데이터베이스의
RLS와 함수 권한이 곧 백엔드 접근 제어다.

## 3. 한 번의 박스 개봉 흐름

### 3.1 세트 선택

1. Next.js 앱이 data/sets에서 동기화된 public/sets JSON을 정적으로 읽는다.
2. 카드 이미지는 JSON의 경로를 256·512 WebP CDN URL로 해석한다.
3. 세트 목록과 카드 메타를 읽는 동안 Supabase DB 조회는 발생하지 않는다.

### 3.2 시뮬레이션

1. UI는 simulator.ts의 simulateBox만 호출한다.
2. 내부에서 세트 유형에 따라 expansion, hi-class, starter 모델로 분기한다.
3. rarity와 card_type별 카드 풀을 만든다.
4. 박스 보장·변동 hit slot을 먼저 생성한다.
5. 중복 방지 규칙을 적용하고 hit slot 위치를 셔플한다.
6. 각 hit를 실제 팩의 일반 카드와 조합한다.
7. 결과와 rarity 요약을 브라우저에 반환한다.

서버에 “랜덤 카드 한 장 달라”는 요청을 하지 않는다. 장점은 응답 지연과 서버 연산 비용이
없다는 것이고, 단점은 로직이 클라이언트에 공개된다는 것이다. 이 서비스는 경쟁 게임이나
금전 거래가 아니므로 공개 가능성보다 비용과 재현성을 우선했다.

### 3.3 로컬 기록

1. 개봉 결과에서 누적 운에 필요한 세트·박스·팩·rarity·힛카드만 요약한다.
2. 현재 owner가 없으면 게스트 키, 로그인 상태면 사용자별 키에 즉시 저장한다.
3. 힛카드 도감은 카드 키와 획득 횟수만 별도 저장한다.
4. 운 기록 초기화와 도감 초기화는 서로 다른 사용자 의도이므로 분리한다.

### 3.4 익명 분석

1. sim_events에는 세션, 세트, 박스·팩 수, 시뮬 금액 같은 집계용 값이 INSERT된다.
2. user_events에는 page_view, 개봉 시작, 운 확인 같은 퍼널 이벤트가 INSERT된다.
3. anon과 authenticated 역할은 INSERT만 가능하고 원본 SELECT·UPDATE·DELETE는 불가능하다.
4. INSERT 트리거가 일별 집계와 글로벌 통계 캐시를 함께 갱신한다.
5. 메인의 글로벌 통계는 원본이 아니라 analytics_global_stats 한 행을 RPC로 읽는다.

분석 전송이 실패해도 개봉 결과와 로컬 기록은 이미 브라우저에 있으므로 핵심 UX는 유지된다.

## 4. 계정 기록 보관 흐름

    게스트 localStorage
      |
      | 사용자가 Google 보관 선택
      v
    Google Identity Services 팝업
      |
      | ID token + nonce
      v
    Supabase Auth
      |
      +--> 계정별 localStorage 즉시 복원
      |
      +--> user_record_backups 한 행 읽기
              |
              +--> 기기 source별 스냅샷 병합
              +--> revision 확인
              +--> 15초 debounce 후 저장 RPC

### 왜 자동 로그인이 아닌가

박스깡은 짧고 가벼운 경험이다. 첫 진입부터 인증을 요구하면 사용자가 제품 가치를 확인하기
전에 비용을 지불하게 된다. 따라서 다음 순서를 선택했다.

1. 익명으로 전체 기능을 경험한다.
2. 기록이 쌓여 보관 가치가 생긴다.
3. 사용자가 직접 Google 보관을 선택한다.
4. 기존 게스트 기록을 계정에 옮길지 확인한다.

### 왜 게스트와 계정 localStorage를 분리하는가

같은 키를 사용하면 로그아웃했을 때 다른 사람의 계정 기록이 게스트 화면에 노출될 수 있다.
owner별 키를 사용하면 다음 불변식을 지킬 수 있다.

- 게스트 기록은 로그인·로그아웃으로 사라지지 않는다.
- 계정 A와 계정 B의 로컬 캐시는 섞이지 않는다.
- 로그아웃은 계정 기록을 게스트 영역으로 복사하지 않는다.
- 계정 삭제는 해당 계정 캐시만 지우고 게스트 기록은 유지한다.

### 왜 source_id와 revision이 모두 필요한가

- **source_id:** 브라우저 A와 B가 만든 누적값을 별도 원본으로 보존한다.
- **revision:** 두 브라우저가 같은 서버 버전을 동시에 덮어쓰는 lost update를 감지한다.

저장할 때 기대 revision이 현재 DB와 다르면 RPC가 충돌을 반환한다. 클라이언트는 최신
payload를 다시 읽고 현재 source를 합친 뒤 한 번 재시도한다. source 분리 없이 전체 합계만
다시 더하면 같은 기록을 반복 합산하기 쉽다.

### 왜 사용자당 한 행인가

대안은 개봉·카드마다 행을 저장하는 정규화 구조다. 검색과 세밀한 분석에는 유리하지만,
이 기능의 목적은 소셜 피드나 거래 내역이 아니라 **내 기록 복원**이다.

한 행 스냅샷을 선택한 이유:

- 사용자 수에 비례하는 예측 가능한 행 수.
- payload 64KB와 source 8개라는 저장 예산.
- 한 번의 읽기로 전체 기록 복원.
- 일반 카드 메타를 중복 저장하지 않고 정적 JSON으로 재구성.
- 무료 플랜에서 인덱스와 쿼리 비용이 작다.

단점은 카드별 SQL 검색과 부분 업데이트가 어렵다는 것이다. 향후 랭킹이나 공개 프로필이
필요해지면 그 기능만 별도 집계 테이블로 분리해야 한다.

## 5. Supabase 보안 경계

### 공개해도 되는 값

- Supabase URL
- Supabase publishable key
- Google Web Client ID

이 값들은 브라우저 네트워크 탭에서 볼 수 있다. 보안은 값을 숨기는 데 있지 않고 RLS와
허용된 RPC 범위를 정확히 제한하는 데 있다.

### 공개하면 안 되는 값

- Google Client Secret
- Supabase service role key
- DB 비밀번호

Secret은 Supabase 또는 배포 환경의 서버 전용 설정에만 둔다.

### RLS와 RPC의 역할

user_record_backups는 RLS로 auth.uid()와 user_id가 같은 행만 SELECT할 수 있다.
클라이언트에는 직접 INSERT·UPDATE 권한을 주지 않고 save_user_record_backup RPC만
실행하게 한다.

RPC가 SECURITY DEFINER인 이유는 제한된 검증 절차 안에서 테이블을 수정할 권한이
필요하기 때문이다. 대신 다음 안전장치를 둔다.

- 클라이언트가 user_id를 전달하지 않고 auth.uid()만 사용한다.
- payload 형태, source 수, 64KB 크기를 서버에서 다시 검사한다.
- search_path를 비우거나 고정하고 public 스키마를 명시한다.
- anon 실행 권한을 제거하고 authenticated에만 허용한다.
- 계정 삭제도 전달받은 ID가 아니라 auth.uid() 본인만 대상으로 한다.

SECURITY DEFINER는 편리해서 쓰는 옵션이 아니라, **좁은 명령만 허용하는 서버 API
경계**로 취급해야 한다.

## 6. 분석 데이터 구조

### 원본과 장기 지표 분리

    user_events (30일 원본)
      +--> analytics_visitors
      +--> analytics_user_daily_activity
      +--> analytics_user_daily

    sim_events (14일 원본)
      +--> analytics_sim_archive
      +--> analytics_sim_daily
      +--> analytics_sim_daily_sessions
      +--> analytics_global_stats

원본 이벤트는 최근 퍼널·유입·장애 분석에 필요하다. 하지만 DAU와 D1·D7 리텐션은
오래된 모든 이벤트를 보존하지 않아도 방문자별 하루 한 행이면 계산할 수 있다.

### 보존 순서

1. 원본에서 영구 집계를 백필한다.
2. 새 INSERT를 영구 집계에 반영하는 트리거를 설치한다.
3. 누적 archive를 갱신한다.
4. 보존 기간이 지난 원본만 삭제한다.
5. 매일 pg_cron으로 반복한다.

집계보다 삭제를 먼저 하면 되돌릴 수 없는 데이터 손실이 생긴다. 이 순서가 마이그레이션의
가장 중요한 불변식이다.

### 인덱스 선택

B-tree는 정확한 값과 범위 검색에 빠르지만 각 행에 가까운 크기로 커질 수 있다.
이벤트의 created_at은 대체로 삽입 순서와 같으므로 오래된 기간 삭제에는 작은 BRIN이
적합하다. 반대로 세트 인기도와 세션 조회처럼 자주 쓰는 인덱스는 유지했다.

인덱스는 “있으면 빠르다”가 아니라 **쓰기 비용·저장 공간·실제 조회 빈도와 교환하는
자료구조**다. pg_stat_user_indexes의 idx_scan과 크기를 함께 봐야 한다.

## 7. 글로벌 통계 500 장애에서 배울 점

### 이전 구조

get_global_stats가 호출될 때마다 다음 값을 계산했다.

- archive 누적값
- 최근 sim_events COUNT DISTINCT session_id
- 최근 sim_events COUNT와 SUM

원본이 작을 때는 단순하고 정확했다. 약 75만 행 이상의 최근 이벤트가 쌓이자 공개 RPC의
짧은 statement timeout을 간헐적으로 넘겨 500이 발생했다.

### 고려 가능한 대안

| 대안 | 장점 | 단점 |
| --- | --- | --- |
| statement timeout 증가 | 변경이 작음 | 요청마다 전체 스캔하는 비용은 계속 증가 |
| 복합 인덱스 추가 | 일부 집계 개선 가능 | COUNT·SUM 전체 읽기와 인덱스 공간 문제 지속 |
| 일정 시간 캐시 | 쓰기 변경이 적음 | 만료·동시 갱신·첫 요청 지연 관리 필요 |
| 쓰기 시 누적 한 행 | 조회가 상수 시간 | INSERT 트리거와 초기 전환 정합성 필요 |

현재 통계는 합계만 필요하므로 쓰기 시 누적 한 행을 선택했다.

### 전환 정합성

초기값을 복사하는 사이 새 sim_events가 들어오면 누락되거나 이중 합산될 수 있다.
마이그레이션은 한 트랜잭션에서 sim_events의 쓰기를 잠깐 대기시킨다.

1. 잠금 전에 commit된 행은 baseline 전체 스캔에 포함된다.
2. 캐시와 새 트리거를 같은 트랜잭션에서 만든다.
3. commit 뒤 들어오는 행은 새 트리거가 캐시에 더한다.
4. 실패하면 트랜잭션 전체가 rollback된다.

캐시 테이블은 RLS와 권한 회수로 직접 읽지 못하게 하고, 공개 RPC만 한 행을 반환한다.

## 8. 카드 데이터 파이프라인

    한국 공식 카드 DB
      |
      v
    수집·정규화 ------> data/sets/{code}.json (SSOT)
      ^                         |
      |                         +--> rarity·번호·이름·가격 검증
    일본판 누락 보강            +--> 봉입 모델·운 분포 검증
                                +--> frontend/public/sets 동기화
                                |
    원본 카드 이미지 ----------> 256·512 WebP ----------> R2 CDN

### 왜 data와 frontend/public을 분리하는가

data/sets는 수집·감사 도구가 사용하는 원본이다. frontend/public은 앱 배포 산출물이다.
직접 두 곳을 수정하면 쉽게 달라지므로 sync 명령으로 한 방향 복사한다.

### 왜 한국 공식 DB만으로 끝나지 않는가

한국판과 일본판의 카드 구성이 대응되지만 한국 공식 검색에 일부 고레어 상세가 없을 수 있다.
“검색되지 않음”을 “미수록”으로 판단하면 힛카드가 누락된다. 일본판 전체 번호와 대조하고
한국 정식명을 복원하되, 출처와 추정 가격을 데이터에 남긴다.

### 검증 층

1. **스키마:** 필수 필드, 알려진 rarity, 중복 card_num.
2. **coverage:** 대응 일본판 전체 번호와 누락 대조.
3. **이미지:** 404, 중복, 크기, 밝기, 256·512 variant.
4. **시뮬:** 카드 풀이 실제 슬롯에서 도달 가능한지 검사.
5. **분포:** 대량 박스 결과가 목표 봉입 모델 범위에 드는지 검사.
6. **운:** 박스와 낱팩 기대값, 고정 슬롯 baseline, 가격 운 분포 검사.

## 9. 이미지 전달 구조

카드 원본을 그대로 그리면 목록과 도감에서 큰 파일을 수백 장 요청하게 된다.

- 256 WebP: 작은 카드 그리드와 모바일.
- 512 WebP: 상세 모달과 고밀도 화면.
- 원본: 명시적으로 필요한 경우의 fallback.
- CDN 도메인: img.pokesim.kr.

브라우저가 필요한 크기만 받고, 원본 사이트 핫링크에 의존하지 않는다. 이미지 주소가
네트워크 탭에 보이는 것은 정상이다. 접근 제어 대상인 사용자 데이터와 달리 카드 이미지는
공개 정적 자산이다.

## 10. 주요 트레이드오프

| 선택 | 얻은 것 | 포기한 것·대응 |
| --- | --- | --- |
| 클라이언트 시뮬 | 서버 비용 0, 즉시 응답, seed 재현 | 로직 공개; 금전 거래 기능이 아니므로 수용 |
| 정적 카드 JSON | 저렴한 읽기, 단순 배포 | 실시간 수정 어려움; sync·재배포 파이프라인 |
| local-first | 로그인 장애와 무관한 핵심 UX | 동기화 복잡도; owner/source/revision으로 관리 |
| 사용자당 한 행 | 예측 가능한 DB 비용 | SQL 카드별 분석 어려움; 별도 익명 집계 사용 |
| Supabase 직접 연결 | 별도 서버 운영 제거 | RLS가 API 경계; 검증 쿼리와 최소 권한 필수 |
| 원본 retention | DB 크기 제한 | 오래된 상세 이벤트 포기; 장기 지표 선집계 |
| 쓰기 시 통계 캐시 | 빠른 공개 조회 | 쓰기 트리거 비용; 단일 합계라 비용이 작음 |
| 추정 봉입률 공개 | 데이터 정직성과 수정 가능성 | “완전 정확함”을 주장할 수 없음 |

## 11. 장애와 진단 지도

| 증상 | 먼저 볼 곳 | 배운 점 |
| --- | --- | --- |
| 로그인 후 이벤트 POST 403 | RLS policy와 authenticated INSERT 권한 | 로그인하면 JWT 역할이 anon에서 바뀐다 |
| RPC·테이블 schema cache 오류 | 마이그레이션 적용 여부, PostgREST reload | 코드와 운영 DB 배포 순서를 함께 관리한다 |
| get_global_stats 500 | Postgres 57014, 실행계획 | 읽기 경로의 전체 집계는 데이터와 함께 느려진다 |
| DB 500MB 초과 | 테이블·인덱스 크기와 idx_scan | 행보다 인덱스가 더 클 수 있다 |
| 다른 기기 기록 덮어쓰기 | revision과 source_id | last-write-wins가 항상 안전하지 않다 |
| 로그인 전 기록 중복 합산 | 병합 marker와 idempotency 검증 | 재시도 가능한 흐름은 중복 실행을 전제로 한다 |
| 특정 SAR가 안 나옴 | rarity pool, card_type 필터, 번호 범위 | 화면 노출과 시뮬 도달성은 별도 검증 대상이다 |
| 어둡거나 빈 카드 이미지 | 원본 URL, variant 생성, CDN 404 | 데이터 품질과 전달 품질을 따로 검사한다 |

## 12. 코드 읽기 순서

### 1단계: 화면에서 시뮬까지

1. [앱 진입](../frontend/app/page.tsx)
2. [세트 선택](../frontend/components/SetPicker.tsx)
3. [박스 시뮬레이터](../frontend/components/BoxSimulator.tsx)
4. [시뮬 공개 API](../frontend/lib/simulator.ts)
5. [확장팩 모델](../frontend/lib/simulation/expansion.ts)
6. [하이클래스 모델](../frontend/lib/simulation/hi-class.ts)
7. [공통 확률 모델](../frontend/lib/simulation/model.ts)

### 2단계: 결과에서 운과 도감까지

1. [개봉 기록](../frontend/lib/openingHistory.ts)
2. [운 계산](../frontend/lib/luck.ts)
3. [가격 운](../frontend/lib/valueLuck.ts)
4. [힛카드 도감](../frontend/lib/hitDex.ts)
5. [레어도·효과](../frontend/lib/rarity.ts)

### 3단계: 로그인과 백업

1. [Supabase 클라이언트](../frontend/lib/supabase.ts)
2. [인증 상태](../frontend/lib/auth.ts)
3. [백업 payload](../frontend/lib/recordBackup.ts)
4. [동기화 hook](../frontend/lib/useRecordBackup.ts)
5. [백업 SQL](../supabase/migrations/20260713000010_user_record_backup.sql)
6. [계정 삭제 SQL](../supabase/migrations/20260714000011_delete_user_account.sql)

### 4단계: 분석과 비용

1. [분석 전송](../frontend/lib/statsTracker.ts)
2. [rollup·retention](../supabase/migrations/20260712000008_rollup_and_retain_analytics.sql)
3. [일별 보존](../supabase/migrations/20260712000009_preserve_daily_analytics.sql)
4. [글로벌 캐시](../supabase/migrations/20260715000013_cache_global_stats.sql)
5. [비용 최적화 사례](supabase-analytics-cost-optimization.md)

### 5단계: 데이터 운영

1. [세트 파이프라인](card-set-pipeline.md)
2. [데이터 수집](../scripts/fetch-pokemoncard.ts)
3. [데이터 검증](../scripts/validate-card-data.ts)
4. [coverage 검사](../scripts/audit-card-coverage.ts)
5. [이미지 최적화](../scripts/optimize-card-images.ts)

## 13. 직접 해볼 학습 과제

### 과제 A. 박스 한 번을 추적한다

하나의 set code와 seed를 정하고 simulateBox부터 최종 rarityCounts까지 호출 흐름을
종이에 그린다. 다음을 표시한다.

- 랜덤이 사용되는 지점
- 박스 보장 슬롯
- 중복 허용·금지 경계
- 운 점수에서 차감되는 baseline

### 과제 B. 동기화 충돌을 재현한다

두 브라우저가 같은 revision을 읽고 각자 다른 카드를 등록했다고 가정한다.

1. 먼저 저장한 브라우저의 revision 변화.
2. 늦게 저장한 브라우저가 받는 오류.
3. 최신 서버 payload와 현재 source를 어떻게 합쳐야 하는지 설명한다.
4. 전체 누적값을 단순 합산하면 왜 중복되는지 예를 만든다.

### 과제 C. SQL 실행계획을 비교한다

운영 데이터 복사본 또는 안전한 환경에서 이전 전체 집계 쿼리와 현재 get_global_stats의
EXPLAIN ANALYZE를 비교한다.

- 읽은 buffer 수
- 실행 시간
- 데이터 증가에 따른 시간 복잡도
- INSERT 한 번당 추가된 트리거 비용

### 과제 D. 새 세트를 추가한다

card-set-pipeline의 체크리스트를 따라 테스트 세트 하나를 추가한다고 가정하고,
어느 단계가 자동이고 어느 단계가 사람의 판단인지 나눈다. 봉입률과 가격의 출처가
불확실할 때 화면과 데이터에 어떤 표현을 남길지도 적는다.

## 14. 셀프 면접 질문

1. 카드 메타를 Supabase 테이블로 옮기지 않은 이유는?
2. 시뮬을 서버에서 실행해야 하는 상황은 언제인가?
3. publishable key가 노출돼도 되는 이유와 service role key가 안 되는 이유는?
4. RLS가 있는데 왜 저장 RPC가 필요한가?
5. SECURITY DEFINER 함수에서 search_path를 제한하는 이유는?
6. local-first에서 서버가 진실의 원천인가, 브라우저가 진실의 원천인가?
7. 낙관적 잠금이 실패했을 때 무조건 재시도하면 안 되는 이유는?
8. 원본 이벤트를 삭제하고도 D7 리텐션을 계산하는 데 필요한 최소 데이터는?
9. BRIN이 B-tree보다 불리한 쿼리는 무엇인가?
10. 글로벌 합계를 읽기 시 계산하지 않고 쓰기 시 누적할 때 정합성 위험은?
11. 사용자 수가 1만 DAU가 되면 가장 먼저 측정할 병목은?
12. 공개 카드 이미지와 개인정보 데이터의 보안 요구가 왜 다른가?

## 15. 답변의 핵심

- 정적이고 공통인 데이터는 CDN이 가장 싸고 단순하다.
- 금전·경쟁 결과가 아닌 시뮬은 클라이언트 실행의 이점이 크다.
- 공개 키의 권한은 RLS로 제한하고 비밀 키는 브라우저에 두지 않는다.
- RPC는 payload 검증과 원자적 revision 비교를 한 서버 경계에 묶는다.
- localStorage는 즉시 UX, 서버 스냅샷은 계정 간 복원 역할을 한다.
- 장기 지표를 먼저 rollup하면 상세 원본의 수명을 제한할 수 있다.
- 읽기 전체 스캔을 캐시로 옮길 때 baseline과 trigger 전환을 같은 트랜잭션으로 보호해야 한다.
- 1만 DAU에서는 DB 용량만이 아니라 INSERT TPS, trigger 시간, R2 요청, 번들·도감 렌더링,
  동기화 오류율을 실제 측정한 뒤 확장한다.

## 16. 현재 한계와 다음 설계 질문

- 한국판 공식 봉입률은 비공개라 모델은 계속 검증·갱신해야 한다.
- UI 회귀는 스모크 테스트 비중이 높아 핵심 플로우 Playwright 자동화 여지가 있다.
- 사용자 기록은 복원에 최적화돼 공개 랭킹·검색에는 적합하지 않다.
- 세트별 예외가 늘면 선언형 모델 스키마로 더 이동할 시점을 정해야 한다.
- 분석 이벤트가 다시 증가하면 월 단위 집계나 외부 분석 저장소가 필요한지 비용을 비교해야 한다.
- 이미지 저작권과 공식 요청 가능성에 대비해 자산 출처·삭제 경로를 계속 관리해야 한다.

## 17. 함께 읽을 문서

- [포트폴리오 사례](portfolio-case-study.md)
- [프로젝트 결정 SSOT](../AGENTS.md)
- [시뮬레이터 구조](simulator-architecture.md)
- [선택형 기록 보관](record-backup.md)
- [분석 DB 비용 최적화](supabase-analytics-cost-optimization.md)
- [카드 세트 파이프라인](card-set-pipeline.md)
- [이미지 전달 구조](image-delivery.md)
- [릴리스 스모크 테스트](release-smoke-test.md)
