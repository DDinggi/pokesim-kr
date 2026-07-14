# 선택형 내 기록 보관

## 목적

박스깡은 로그인 없이 유지하면서, 사용자가 원할 때만 누적 운 기록과 힛카드 도감을
Google 계정에 보관해 다른 기기에서 이어본다.

## 사용자 흐름

1. 비로그인 사용자는 박스깡, 운 기록, 도감을 브라우저에 저장한다.
2. `내 기록`의 Google 공식 버튼을 누른 경우에만 계정 선택 팝업을 연다.
3. 로그인 전 기록이 있으면 계정으로 옮길지 확인한다.
4. 옮기기를 선택하면 서버 저장 성공 뒤에만 비로그인 원본을 비운다.
5. 로그아웃하면 계정 기록을 게스트 영역으로 복사하지 않고 비로그인 기록으로 전환한다.
6. 같은 계정으로 다시 로그인하면 서버 기록을 불러온다.
7. 모든 주요 화면의 계정 메뉴에서 마이페이지로 들어가 Google 아이디를 확인하고 닉네임을 변경할 수 있다.
8. 개인정보처리방침의 연락처로 현재 계정의 저장 기록 열람을 요청할 수 있다.
9. 계정 탈퇴를 선택하면 PokéSim KR 계정과 서버 보관 기록, 해당 계정의 로컬 캐시를 즉시 삭제한다. 게스트 기록은 유지한다.

기능 도입 전에 만들어진 비로그인 기록도 같은 게스트 저장소에서 감지한다. 이미 Google
로그인 세션이 남아 있는 브라우저라면 첫 진입 때 옮기기 여부를 묻고, `따로 두기`를 고르면
기존 기록은 삭제하지 않은 채 로그아웃했을 때 다시 보여준다.

## 로컬 경계

- 비로그인 기록과 계정별 로컬 캐시는 서로 다른 `localStorage` 키를 사용한다.
- 로그인 상태에서 만든 기록은 계정 전용 로컬 캐시에 즉시 반영한다.
- 서버 동기화 실패 시 계정 로컬 캐시를 남겨 다음 로그인이나 재시도 때 다시 보낸다.
- 운 기록 초기화는 도감 획득 기록을 삭제하지 않는다.

## 서버 저장 범위

Supabase `user_record_backups`는 사용자당 한 행만 사용한다. `payload`는 최대 64KB이며,
기기별 `source_id` 아래에 다음 압축값만 저장한다.

한 계정에 연결된 브라우저가 8개를 넘으면 기존 기록을 조용히 버리지 않고 동기화를 실패 처리한다.
사용자는 기존 브라우저 기록을 유지한 채 안내를 확인하고 다시 시도할 수 있다.

- 세트별 박스·팩 수와 사용 금액 합계
- 레어도별 획득 수
- 운 계산에 필요한 힛카드 번호와 수량
- 도감 카드 키와 획득 수

일반 카드, 이미지, 카드 이름, 정적 카드 메타와 가격은 저장하지 않는다. 화면 복원에는
정적 세트 JSON을 사용한다. 최초 닉네임은 Google email의 `@` 앞부분을 사용한다. 사용자가 바꾼
닉네임은 백업 payload가 아니라 Supabase Auth 사용자 메타데이터의 `display_name`에 저장한다.

## 충돌과 보안

- RLS로 본인 행만 읽을 수 있다.
- 쓰기는 `auth.uid()`를 사용하는 `security definer` RPC로 제한한다.
- 계정 삭제 RPC는 클라이언트가 사용자 ID를 넘기지 않고 `auth.uid()`의 본인 계정만 삭제한다.
- 계정 삭제 시 `ON DELETE CASCADE`로 백업도 삭제하고, 클라이언트의 해당 계정 캐시와 세션을 비운다.
- `revision`이 다른 쓰기는 충돌로 처리하고 최신 스냅샷을 다시 받아 한 번 재시도한다.
- 기기별 소스를 분리해 두 기기의 누적값이 서로를 덮어쓰지 않게 한다.
- 로그인 전 병합은 로컬 병합 마커로 재시도 중 중복 합산을 막는다.

## 관련 파일

- `frontend/lib/openingHistory.ts`: 비로그인·계정별 로컬 개봉 기록
- `frontend/lib/hitDex.ts`: 비로그인·계정별 로컬 도감
- `frontend/lib/recordBackup.ts`: 압축, 복원, Supabase 읽기·쓰기
- `frontend/lib/useRecordBackup.ts`: 동기화, 재시도, 병합, 초기화 흐름
- `frontend/components/LuckScreen.tsx`: `내 기록`의 운 기록 탭
- `frontend/components/HitDexScreen.tsx`: `내 기록`의 도감 탭
- `supabase/migrations/20260713000010_user_record_backup.sql`: 한 행 백업, RLS, 저장 RPC
- `supabase/migrations/20260714000011_delete_user_account.sql`: 본인 계정 즉시 삭제 RPC
- `frontend/app/privacy/page.tsx`: 개인정보처리방침
- `frontend/app/terms/page.tsx`: 이용약관
- `docs/oauth-production-checklist.md`: Google OAuth 운영 공개 체크리스트
- `supabase/queries/verify-user-record-auth.sql`: RLS·RPC 권한 확인

## 운영 적용

1. `20260713000010_user_record_backup.sql` 전체를 Supabase SQL Editor에서 실행한다.
   마지막 `NOTIFY`가 Data API의 함수 스키마 캐시도 새로 읽게 한다.
2. `20260714000011_delete_user_account.sql` 전체를 이어서 실행한다.
3. Supabase `Authentication → Providers → Google`을 활성화하고 Google Web OAuth 클라이언트
   ID와 Secret을 등록한다. Secret은 Supabase에만 두고 프론트 환경 변수에 넣지 않는다.
4. Google Cloud Web 클라이언트의 `승인된 JavaScript 원본`에 아래 주소를 등록한다.
   - `https://pokesim.kr`
   - `https://www.pokesim.kr`
   - `http://localhost:3000`
   - `http://localhost:3001`
5. 로컬과 Cloudflare 빌드 환경에 공개 값인
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Web 클라이언트 ID>`를 등록한다.
6. 기존 Supabase OAuth 콜백 URI와 URL Configuration은 이전 리디렉션 로그인 호환을 위해
   유지한다. 새 로그인은 Google Identity Services 팝업의 ID 토큰을 `signInWithIdToken`으로
   교환하므로 사용자가 `*.supabase.co` 화면으로 이동하지 않는다.
7. 비로그인 기록이 있는 브라우저에서 Google 보관을 누르고 `계정 기록에 옮기기`를 선택한다.
8. 다른 브라우저에서 같은 계정으로 로그인해 누적 운과 도감이 복원되는지 확인한다.
9. Supabase SQL Editor에서 한 사용자당 `user_record_backups` 한 행만 생기고 `payload`가
   64KB 이하인지 확인한다.
10. 테스트 계정으로 탈퇴한 뒤 `auth.users`와 `user_record_backups`에서 해당 행이 함께 삭제되고,
    게스트 기록은 남는지 확인한다.
11. `/privacy`, `/terms`가 로그아웃 상태에서도 열리고, 메인 하단에서 이동되는지 확인한다.
12. 개인정보처리방침에 저장 기록 열람 요청 연락처가 안내되는지 확인한다.

Google Cloud와 Cloudflare의 운영 값은
[`docs/oauth-production-checklist.md`](oauth-production-checklist.md)를 따른다.

마이그레이션이 아직 적용되지 않았거나 네트워크 저장이 실패해도 박스깡과 로컬 기록은
계속 동작한다. 실패 상태에서는 비로그인 원본을 삭제하지 않는다.

### RPC 확인

다음 쿼리 결과에 `save_user_record_backup`과
`p_payload jsonb, p_expected_revision bigint`가 표시되어야 한다.

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_user_record_backup';
```

함수가 보이는데도 `PGRST202`가 계속되면 아래 명령을 한 번 실행한다.

```sql
notify pgrst, 'reload schema';
```
