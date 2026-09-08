# SM/XY 신규 6세트 재검수 — 2026-09-08

Git 커밋·푸시·PR·배포 없이 데이터와 이미지 파이프라인을 재검수했다.

## 범위와 수정

| 세트 | 전체 | 한국 공식 상세 | 일본 이미지 보강 | 고레어 검수 |
| --- | ---: | ---: | ---: | ---: |
| 빛나는 전설 | 91 | 86 | 5 | 18 |
| 각성의 용사 | 62 | 55 | 7 | 12 |
| 초차원의 침략자 | 62 | 55 | 7 | 12 |
| THE BEST OF XY | 188 | 186 | 2 | 17 |
| 어둠을 밝힌 무지개 | 64 | 57 | 7 | 13 |
| 빛을 삼킨 어둠 | 64 | 57 | 7 | 13 |
| 합계 | 531 | 496 | 35 | 85 |

- 이름 수정: `빛나는 뮤츠 GX → 뮤츠 GX`, `바톤터치 → 소원의 바통`,
  `구멍파기 로프 → 동굴탈출로프`, `구조 들것 → 레스큐탱크`.
- 공식 카드명 근거는 `data/manual/sm-legacy-reviewed-cards.json`의 `name_source_card_num`에
  기록했다. 고레어 전부 한국 이름과 일본 번호·이름·등급·일러스트를 함께 대조했다.
- SM3+ `BS2017010062` 수퍼 포켓몬 회수는 한국 인쇄 번호 061,
  `BS2017010061` 수퍼볼은 062이다. 공식 이미지 파일 번호에 맞춰 카드 번호를 바꾸지 않는다.
- THE BEST OF XY 한국 서포트 181/182/183/184/185의 일본판 번호는
  182/184/185/181/183이다. `_jp_number`를 저장했고 가격도 같은 대응표로 매칭했다.
- HR은 HR로 유지한다. THE BEST OF XY의 SR/UR은 [일본 샵의 SR仕様/UR仕様 분류](https://yuyu-tei.jp/sell/poc/s/hp)다.
  [SM3+ #082](https://yuyu-tei.jp/sell/poc/card/sm03plus/10082)는 이름에 `빛나는`이 없는 별표 시크릿이며,
  내부 H 풀을 유지하되 상세 라벨을 `시크릿 (별표)`로 구분한다.

## 카드 이미지

- 상세 모달을 512 WebP 우선에서 **R2 원본 우선, 실패 시 512 폴백**으로 변경했다.
- 가로형 BREAK는 7:5 프레임과 `object-contain`으로 잘리지 않게 했다.
- 일본 보강 35장은 저해상도 소스 대신 yuyu-tei `front`의 500×700 원본으로 교체했다.
  한국 공식 고레어 50장은 868×1212 원본을 유지했다. 일본 이미지를 한국판으로 표시하거나
  500px 소스를 512로 확대한 것을 고해상도 원본이라고 주장하지 않는다.
- 교체 키는 `external/<set>/<card_num>-review-20260908.jpg`; 원본 및 256/512 키를 분리한다.
  기존 키는 삭제하지 않았다. 캐시 버전은 `sm-legacy-reviewed-20260908`이다.

## 박스 출처와 교체 방법

출처는 K-TCG PANDA의 한국판 단일 닫힌 박스 사진이다. 원본은 모두 300×400 수준으로,
사용자가 새 박스 이미지를 제작할 때 참고용이다. 확대 가공이 원본 화질을 높이지는 않는다.

| 세트 코드 | 원본 다운로드 파일명 (`https://k-tcgpanda.com/pimg/` 아래) |
| --- | --- |
| sm3plus-shining-legends | 썬&문 강화 확장팩 박스 빛나는 전설 [SM3+].png |
| sm4s-awakened-heroes | 썬&문 확장팩 박스 각성의 용사 [SM4S].png |
| sm4a-ultradimensional-beasts | 썬&문 확장팩 박스 초차원의 침략자 [SM4A].png |
| smxy-best-of-xy | XY 하이클래스팩 박스 THE BEST OF XY [XY].png |
| sm3h-rainbow-in-darkness | 썬&문 확장팩 박스 어둠을 밝힌 무지개 [SM3H].png |
| sm3n-darkness-devours-light | 썬&문 확장팩 박스 빛을 삼킨 어둠 [SM3N].png |

현재 채택 원본은 `frontend/public/boxes/original/<set>.png`이다. 기존 JPG/WebP 참고 파일은
미사용 상태로 보존했다. 새 이미지로 PNG 원본을 교체한 뒤 다음을 실행한다.

```powershell
pnpm --dir scripts process:box-image -- --input frontend/public/boxes/original/<set>.png --set <set>
```

결과 `boxes/<set>.png`, `boxes/thumbs/<set>.webp`는 각각 768×768이다.
가공 후 6개를 한 이미지 시트로 직접 확인했으며, 한국판 한 박스가 아닌 이미지는 채택하지 않았다.

## 가격·운 모델 및 검증

- FullAhead 68장의 가격 출처 제목을 고레어 일본 이름·번호와 대조했다.
- THE BEST OF XY 17장은 FullAhead 카테고리가 없어 yuyu-tei 판매 표시 가격을
  `price-matches.json`의 `manual_jpy`로 기록했다. 품절 호가를 포함하며 한국 실거래가가 아니다.
  기존 환산 규칙을 적용하고 `build:luck-dist`로 6세트 모두 다시 계산했다.
- 6세트 `validate:data --strict`, `validate:luck --strict`, `validate:value-luck` 통과.
- 각 세트 `validate:box-guarantees --trials 1000` 통과(합계 6,000박스).
- 5개 SM 세트 FullAhead coverage 누락 0. THE BEST OF XY는 yuyu-tei 188종 coverage 누락 0.
- `audit:legacy-sources` 공식 정보·고레어 이름/등급/가격 출처 대조 통과.
- 보강 importer `--dry-run` 33장 일치, THE BEST OF XY TSV 2장 재적용 후 가격/분포 재생성 확인.
- 프런트엔드 lint, 프로덕션 build/타입 검사 통과.
- 상세 컴포넌트 SSR: 뮤츠 원본 URL·정확한 이름·별표 라벨·가로 BREAK 비율 통과.
- 로컬 프로덕션 서버: 박스 PNG/WebP 12개 HTTP 200, 768×768, 세트 JSON 6개 동기화 확인.
- 브라우저 스킬 연결이 없어 실제 클릭/화면 상호작용 테스트는 수행하지 못했다.
- CDN 전체 원본/variant 최종 검사 결과는 업로드 완료 후 아래에 기록한다.
