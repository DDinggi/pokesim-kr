# Google OAuth 운영 공개 체크리스트

PokéSim KR의 Google 로그인은 Google Identity Services 팝업에서 받은 ID 토큰을
Supabase Auth의 `signInWithIdToken`으로 교환한다. 아래 값은 운영 공개 전에 한 번씩 확인한다.

## 1. Google Cloud

Google 인증 플랫폼에서 웹 애플리케이션 클라이언트를 연다.

- 대상: 외부
- 게시 상태: 테스트 완료 후 프로덕션
- 앱 이름: `PokéSim KR`
- 홈페이지: `https://pokesim.kr`
- 개인정보처리방침: `https://pokesim.kr/privacy`
- 이용약관: `https://pokesim.kr/terms`
- 승인된 도메인: `pokesim.kr`
- 승인된 JavaScript 원본:
  - `https://pokesim.kr`
  - `https://www.pokesim.kr`
  - 로컬 테스트에 실제로 쓰는 `http://localhost:<port>`
- 범위: `openid`, `userinfo.email`, `userinfo.profile`만 사용

운영 페이지와 정책 URL은 로그인하지 않은 상태에서도 열려야 한다. 앱 이름, 도메인,
홈페이지의 서비스 정체성이 서로 일치하는지도 확인한다. Google에서 브랜드 인증을
요청하면 Search Console의 도메인 소유권과 위 공개 URL을 기준으로 인증을 마친다.

## 2. Supabase

- 프로젝트 리전: ap-northeast-2 (Northeast Asia (Seoul))

`Authentication -> Providers -> Google`에서 다음을 확인한다.

- Google provider 활성화
- Google Cloud의 Web Client ID 등록
- Google Cloud의 Web Client Secret 등록
- `Skip nonce checks` 비활성화
- `Allow users without an email` 비활성화

Secret은 Supabase에만 저장한다. 프론트엔드와 Git에는 Client Secret을 넣지 않는다.

SQL Editor에서 아래 마이그레이션을 순서대로 적용한다.

1. `20260713000010_user_record_backup.sql`
2. `20260714000011_delete_user_account.sql`

## 3. Cloudflare

Workers 빌드 환경에는 공개 값인 다음 변수만 둔다.

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Google Web Client ID>
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
```

## 4. 공개 전 확인

1. 로그아웃 상태에서 `/privacy`, `/terms`가 정상 표시된다.
2. 메인 하단에서 두 정책 페이지로 이동할 수 있다.
3. `pokesim.kr`에서 Google 계정 선택 팝업이 열리고 `origin_mismatch`가 발생하지 않는다.
4. 비로그인 기록을 계정으로 옮긴 뒤 새 브라우저에서 같은 기록이 복원된다.
5. 개인정보처리방침에서 저장 기록 열람 요청 연락처를 확인할 수 있다.
6. 계정 탈퇴 뒤 Supabase Auth 사용자와 `user_record_backups` 행이 함께 삭제된다.
7. 탈퇴한 Google 계정으로 다시 로그인하면 새 PokéSim KR 계정으로 시작한다.

## 5. 롤백

프론트 오류는 문제 커밋을 `git revert`한 뒤 다시 배포한다. 데이터베이스 마이그레이션은
기존 익명 시뮬레이션 테이블을 변경하지 않으므로 로그인 UI를 숨겨도 박스깡과 로컬 기록은
계속 동작한다. 인증 장애 시 Google provider나 프론트 환경 변수를 제거하기보다 로그인 버튼을
일시적으로 비활성화하고 원인을 먼저 확인한다.
