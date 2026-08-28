# 갓팩 근거 감사 (2026-08-28)

## 채택 기준

갓팩은 다음 조건을 모두 만족할 때만 확률 모델에 넣는다.

1. 해당 세트에서 실제로 나온 구성 증거가 있다.
2. 세트별 표본 분모와 갓팩 발생 건수가 함께 공개돼 있다.
3. 팩/박스 기준을 구분할 수 있다.
4. 공식 수치가 아니며 한국판과 다를 수 있음을 데이터에 남긴다.

“한 카톤에도 없을 수 있다”, “약 N카톤당 1팩”, 단일 개봉 인증처럼 분모와 발생
건수가 없는 자료는 존재 확인에만 쓰고 확률에는 쓰지 않는다.

## 채택

### MEGA 드림 ex

- PokéGet의 일본판 1,000BOX(50카톤) 집계에서 갓팩 14팩이 관측됐다.
- 원 영상의 전사에서 구성은 `AR 1장 + MA 5장 + SAR 4장`으로 확인되며,
  별도 봉입률 정리 자료와 실제 개봉 사진도 같은 구성을 보여 준다.
- 일본 공식 상품 정보상 1BOX는 10팩이다. 1팩 모드는 전체 노출 10,000팩 기준
  `14 / 10,000 = 0.14%`를 사용한다.
- 원 집계는 1,000BOX에서 갓팩 14팩을 보고했다. 발생 박스의 중복 여부는 따로
  공개하지 않았으므로 박스 모드는 한 박스 최대 1팩으로 제한하고 관측 빈도
  `14 / 1,000 = 1.4%`를 사용한다.
- 개별 카드 고정 패턴별 발생 비율은 공개 표본이 부족하다. 시뮬은 레어도 구성을
  고정하고 AR·MA·SAR 각 풀에서 같은 카드 중복을 피하며 균등 선택한다.
- 한국판 자체 실측은 확보하지 못했으므로 일본판 관측치를 준용한 추정치다.

근거(2026-08-28 확인):

- 원 집계 영상(2025-11-28 게시): https://www.youtube.com/watch?v=40DZLMBqG8w
- 같은 영상의 전사(1,000BOX / 14팩 문장 확인): https://mag.moe/2321614/
- 구성 및 일반 봉입률 교차 확인(2026-01-02 갱신): https://pokemon-infomation.com/pull-rates-megadreamex/
- 일본 공식 상품 구성(10장/팩, 10팩/BOX): https://www.pokemoncenter-online.com/9900000006808.html
- 일본 공식 세트 페이지(2025-11-28 발매): https://www.pokemon-card.com/ex/m2a/index.html
- 실제 개봉 사진 1: https://x.com/7k24t93/status/1994216180156944627
- 실제 개봉 사진 2: https://x.com/mim_0319/status/1994231407695286755

## 보류

| 세트 | 확인된 내용 | 보류 이유 |
| --- | --- | --- |
| 테라스탈 페스타 ex | 브이즈 SAR 3장형과 9장형의 실물·구성 존재 | 세트별 발생 건수/분모가 공개되지 않음 |
| 메가브레이브 | 1,000BOX 일반 봉입률 집계 | 갓팩 항목·발생 건수 미기재 |
| 메가심포니아 | 1,000BOX 일반 봉입률 집계 | 갓팩 항목·발생 건수 미기재 |
| 인페르노X | 1,000BOX 일반 봉입률 집계 | 갓팩 항목·발생 건수 미기재 |
| 니힐제로(무니키스제로) | 1,000BOX 일반 봉입률 집계 | 갓팩 항목·발생 건수 미기재 |
| 닌자스피너 | 1,000BOX 일반 봉입률 집계 | 갓팩 항목·발생 건수 미기재 |
| 어비스아이 | 일반 봉입률 표는 약 600BOX, MUR 본문은 1,000BOX로 원문 불일치 | 갓팩 항목·발생 건수 미기재 |
| 스톰에메랄다 | 출시 직후라 적격 대량 집계 미확보 | 원시 기록 없는 SEO성 확률·중량 주장은 산술/상품 분류 오류로 제외 |

일반 봉입률 집계에 갓팩 항목이 없다는 사실은 “0건”을 뜻하지 않는다. 위 세트는
갓팩이 없다고 단정한 것이 아니라, 현재 시뮬에 확률을 넣을 근거가 없어서 보류한 것이다.

검토 자료:

- 테라스탈 페스타 ex: https://pokemon-infomation.com/pull-rates-terafesex/
- 메가브레이브: https://pokemon-infomation.com/https-pokemon-infomation-com-pull-rates-megabrave/
- 메가심포니아: https://pokemon-infomation.com/pull-rates-megasymphonia/
- 인페르노X: https://pokemon-infomation.com/pull-rates-infernox/
- 니힐제로: https://pokemon-infomation.com/pull-rates-munikisuzero/
- 닌자스피너: https://pokemon-infomation.com/pull-rates-ninjaspiner/
- 어비스아이: https://pokemon-infomation.com/pull-rates-abysseye/
- 스톰에메랄다 제외 자료(원시 기록 없음, `100BOX=10카톤` 산술 오류): https://lifematome.blog/pokeca-godpack-stormeme/
- 스톰에메랄다 제외 자료(일반 확장팩을 하이클래스로 오분류): https://lifematome.blog/pokeca-storm-godpack/

## 재검토 조건

보류 세트는 원 영상·원시 표 또는 신뢰 가능한 집계에서 `총 팩/박스 수`와
`갓팩 발생 수`가 함께 확인될 때만 다시 연다. 구성 유형이 여러 개면 유형별 발생 수도
분리해 모델링한다.
