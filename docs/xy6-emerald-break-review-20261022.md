# 에메랄드 브레이크 추가 검토 — 2026-10-22

카드·상품·가격 조사는 2026-10-22, R2 업로드와 CDN 검증은 2026-10-26에 마쳤다.
원장은 [xy6-emerald-break-20261022.json](../data/manual/xy6-emerald-break-20261022.json)이다.

## 한국 상품과 카드 구성

[한국 공식 상품](https://pokemoncard.co.kr/card/47)의 발매일은 **2015-04-01**, 팩은 **5장·500원**, 박스는 **30팩·15,000원**이다.
기존 데이터의 발매일은 맞았지만 팩 1,000원·박스 30,000원은 잘못되어 교정했다.
[일본 공식 상품](https://www.pokemon-card.com/products/xy/xy6.html)은 2015-03-14 발매, 5장·150엔(세전)이며 한국 상품의 정가·발매일과 구분한다.

한국 공식 카드 검색에서 `BS2015004` 접두사로 확인한 **89장 전부**의 상세 페이지를 읽고 이름·번호·희귀도·이미지 키를 기존 데이터와 대조했다. 차이는 없었다.
본편 78종은 C 36·U 24·R 9·RR 9, 시크릿 SR은 11종이다.

일본판 전체 번호에는 다음 UR 2종이 더 있다. 한국 공식 상세와 한국판 실물은 아직 확인하지 못했다.
한국 검색의 부재만으로 미수록 처리하지 않는 D-148/D-152에 따라 대응 일본판을 보강하고, 최종 데이터는 **91종**으로 둔다.
한일 수록 구성이 실측 검증됐다는 뜻은 아니다. 한국판 근거가 생기면 다시 검토한다.

| 번호 | 한국어 카드명 근거 | 일본 대응 카드·이미지 근거 |
| --- | --- | --- |
| 090/078 UR | [에너지 갈아 달기](https://pokemoncard.co.kr/cards/detail/BS2018006055) | [FullAhead 일본판](https://pokemon-card-fullahead.com/shopdetail/000000016497/xy06/page1/recommend/) |
| 091/078 UR | [배틀서처](https://pokemoncard.co.kr/cards/detail/BS201707114) | [FullAhead 일본판](https://pokemon-card-fullahead.com/shopdetail/000000016498/xy06/page1/recommend/) |

보강 카드는 `JP2015XY690`·`JP2015XY691`이라는 별도 ID를 사용하며 한국 공식 카드 ID를 만들지 않는다.
`_image_language: ja`, 원본 이미지 URL, 한국어 이름·등급 출처, 한국판 수록 미확인 메모를 카드마다 보존한다.

## SR 1장 확정 모델 교정

기존 모델은 인접 세트에서 가져온 SR 1장 확정·RR 3~4장이었다.
[2015-03-19 작성자의 실제 개봉 기록](http://blog.livedoor.jp/alice_umbreon/archives/pcg-xy-xy6.html)은 일본 20팩 박스 7개에서 **SR 1·UR 2·RR 21장**을 기록하고, SR 없이 RR 2장만 나온 박스도 명시한다.
따라서 SR 1장 확정을 유지할 수 없다.

작성자는 SR/UR 합계의 빈도를 대략 2박스당 1장으로 정리했다.
한국판 실측을 확보한 것은 아니며, 다음은 일본 자료의 **팩 수에 따른 기대값 적응 모델**이다.

| 항목 | 근거 | 적용 근사 |
| --- | --- | --- |
| SR/UR 전체 | 일본 20팩당 약 0.5장이라는 당시 공개 근사 | `0.5 × 30/20 = 0.75장/한국 박스`; 75% 확률의 0~1장 슬롯 |
| RR | 직접 개봉 `21장 / 7박스 = 3장/20팩` | `3 × 30/20 = 4.5장`; 4~5장, 5번째 장 50% |
| 고레어 내부 | SR 11종·UR 2종의 대응 카드풀 | 각 카드 1/13 균등 폴백; SR/UR 비율 실측이 아님 |
| 추가 고레어 | 2SR 박스의 존재 보고만 있음 | 빈도·분모 미확인으로 별도 추가 슬롯을 만들지 않음 |

관측 7박스 중 고레어 3장을 정밀 확률 `3/7`로 고정하거나, UR 2장을 근거로 고레어의 2/3을 UR로 만들지 않는다.
75%는 한국 실측 발생률이 아니라 공개 근사를 환산한 기대값을 최대 1장 슬롯으로 구현한 것이다.
RR 4~5장 역시 실제 한국 박스의 최소·최대 보장을 확인했다는 뜻이 아니다.
일본 자료의 초판/재판은 구분되지 않으며 `_sample_size`는 혼합 적응 모델이라 `null`로 유지하고, **직접 관측 7박스는 별도 `sample`에 기록**한다.

자료는 일본 박스에서 홀로가 약 10팩이라고도 설명한다. C/U/R 전체 분포, 고레어와 RR의 상관관계, 한국판의 판본별 배치까지 검증한 것은 아니다.
같은 C/U/R/RR 카드의 중복은 허용한다.

## 가격 매핑과 한계

기존 가격은 한국·일본의 번호를 그대로 대응해 **민진 SR과 은송 SR이 서로 바뀌어 있었다**.

| 한국 번호 | 한국 카드명 | 일본 번호·이름 |
| --- | --- | --- |
| 088 | [민진](https://pokemoncard.co.kr/cards/detail/BS2015004088) | [089 ミツル](https://pokemon-card-fullahead.com/shopdetail/000000016496/xy06/page1/recommend/) |
| 089 | [은송](https://pokemoncard.co.kr/cards/detail/BS2015004089) | [088 ナギ](https://pokemon-card-fullahead.com/shopdetail/000000016495/xy06/page1/recommend/) |

`_jp_number`로 이 매핑을 고정했다. 일반 트레이너도 70↔71, 73↔74, 75↔76의 번호 차이가 있어 함께 기록했다.
2026-10-22 [FullAhead 공개 목록](https://pokemon-card-fullahead.com/shopbrand/xy06/)에서 SR/UR **13종을 카드명·희귀도로 확인**하고 참고가를 갱신했다.
원장에 일본 상품명·번호·판매가·URL·조회일과 환산값을 함께 보존했다.

환산식은 기존 `price-matches.json`의 **JPY/KRW 9.5 × 한국 보정계수 0.65**, 100원 단위 반올림이다.
이는 과거에 설정한 환율과 보정계수이며 현재 환율이나 한국 실거래가를 보증하지 않는다.
일본 카드샵의 **판매 호가 기반 참고가**이고, 고가 카드·저유통 카드일수록 한국 시세와 차이가 클 수 있다.
국내 C2C 가격을 새로 채택하지 않았다. 기존 운영 범위에 따라 C/U/R/RR 78종은 가격 미입력을 유지하고 임의 가격·0원을 추가하지 않는다.

## 이미지와 검증

- 한국 공식89종의 원본은225×314다. 기존256/512 WebP도225px였으므로 버전된 새 키에서 규격대로
  리사이즈했다. 업스케일이며 고해상도 실물 이미지를 새로 확보했다는 뜻이 아니다.
  이전 기록의 이미지 키는 교체 매핑으로 연결했다.
- 보강 UR 2종은 일본 이미지의 카드명·번호·금색 UR 표시를 눈으로 확인했다. 원본 크기는 각각 284×400·287×400이며 512 변형은 업스케일이므로 원본 이상의 세부 정보가 생기는 것은 아니다.
- 버전이 포함된 새 R2 키에 UR 원본 2개와 256/512 WebP 4개를 업로드했다.
- 2026-10-26 R2 인증 `HeadObject`에서 **원본 91개 존재**, 공개 CDN `HEAD`에서 **256/512 WebP 182개 전부 200**을 확인했다.
- 공개 원본 JPG 경로는 403을 반환하지만 R2 원본은 존재한다. 서비스의 WebP 변형 경로로 검증했다.
- 카드 데이터 검사 통과. 카드 번호 coverage는 **local 91/91**, 고레어 참고가 누락 **0/13**으로 통과했다.

재현 명령:

```powershell
pnpm --dir scripts exec tsx validate-card-data.ts --set xy6-emerald-break
pnpm --dir scripts exec tsx audit-card-coverage.ts --set xy6-emerald-break --show-ok
pnpm --dir scripts exec tsx migrate-to-r2.ts --set xy6-emerald-break --verify-only
pnpm --dir scripts validate:box-guarantees -- --set xy6-emerald-break --trials 1000
pnpm --dir scripts validate:luck -- --set xy6-emerald-break --strict
pnpm --dir scripts build:luck-dist -- --set xy6-emerald-break
pnpm --dir scripts sync -- --set xy6-emerald-break
```

2026-10-26 공유 모델 반영 후 운 분포를 재생성했다. 1,000박스 보장·운strict·가치 운 검사를 통과했고,
추가4,000박스·60,000낱팩에서91종 도달성·팩 모양·동일 시드를 확인했다. 새 키의256/512 WebP182개
규격 검사도 통과했다. 이는 시뮬 구현 검증이며 실물 봉입률 관측이 아니다.
