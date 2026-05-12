# Simulator Architecture

시뮬레이터는 컴포넌트에서 직접 복잡한 봉입률 코드를 보지 않도록
`frontend/lib/simulator.ts`를 얇은 공개 API로 두고, 실제 구현을
`frontend/lib/simulation/` 아래로 나눈다.

## 공개 API

컴포넌트는 이 세 가지만 사용한다.

```ts
import { simulateBox, simulatePack, PROBABILITY_META } from '../lib/simulator';
```

- `simulateBox(cards, boxSize, type, packSize, seed, setCode)`
- `simulatePack(cards, type, packSize, seed, setCode)`
- `PROBABILITY_META`

## 내부 파일

| 파일 | 역할 |
| --- | --- |
| `model.ts` | 세트별 봉입률 상수, 출처 메타, 공통 확률값 |
| `random.ts` | seedrandom 기반 pick, weighted pick, shuffle |
| `types.ts` | 시뮬 내부 타입 |
| `pools.ts` | rarity/card_type별 카드 풀 생성과 가중치 필터링 |
| `pack-builders.ts` | hit slot을 실제 5장 팩으로 변환 |
| `expansion.ts` | 일반/MEGA 확장팩 박스 및 1팩 모델 |
| `hi-class.ts` | 하이클래스팩 박스 및 1팩 모델 |

## 일반 확장팩 박스 흐름

1. 세트 카드들을 rarity별로 그룹화한다.
2. 박스 단위 hit slot을 먼저 만든다.
3. hit slot 위치를 셔플한다.
4. 각 hit slot을 `C/C/C/U/hit` 형태의 팩으로 변환한다.
5. 모든 팩을 합산해 rarity summary를 만든다.

이 방식 때문에 박스 보장 룰을 정확히 제어할 수 있다.

## 이번 세 세트 모델

| 세트 | ACE | RR | AR | SR/SAR/UR 슬롯 | 2장 박스 |
| --- | --- | --- | --- | --- | --- |
| 배틀파트너즈 | 없음 | 4장, 약 10%로 5장 | 3장 | 1장 | 약 10% |
| 스텔라미라클 | 1장 | 4장, 약 10%로 5장 | 3장 | 1장 | 약 10% |
| 낙원드래고나 | 1장 | 4장, 약 10%로 5장 | 3장 | 1장 | 약 10% |

`SR/SAR/UR 슬롯 1장`은 SR 카드가 반드시 1장 나온다는 뜻이 아니다.
SAR나 UR이 나오면 SR은 0장일 수 있다. 2장 박스에서는 추가 SR 슬롯이 붙는
모델로 둔다.

트레이너 SR 1장 + 포켓몬 SR 1장처럼 슬롯이 둘로 고정된 모델은 현재 MEGA
확장팩 쪽에만 적용한다. 배틀파트너즈/스텔라미라클/낙원드래고나는 하나의
SR/SAR/UR 슬롯 안에서 포켓몬 SR, 서포트 SR, SAR, UR을 가중 추첨한다.

세트별 고레어 기대값:

| 세트 | 포켓몬 SR | 서포트 SR | SAR | UR | 표본 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 배틀파트너즈 | 55% | 25% | 20% | 10% | 약 1,000BOX |
| 스텔라미라클 | 50% | 30% | 20% | 10% | 약 1,000BOX |
| 낙원드래고나 | 50% | 30% | 20% | 10% | 약 480BOX |

출처:

- https://pokemon-infomation.com/pull-rates-battlepartner/
- https://pokemon-infomation.com/pull-rates-stellamiracle/
- https://pokemon-infomation.com/pull-rates-rakuendoragona/
- 공식 제품 메타: https://pokemoncard.co.kr/card/731,
  https://pokemoncard.co.kr/card/659, https://pokemoncard.co.kr/card/668

## 1팩 / 자판기 모델

1팩은 박스 보장 슬롯을 그대로 적용할 수 없다. 대신 박스 모델의 기대값을
30팩으로 나눠 hit pool 가중치로 환산한다.

예를 들어 스텔라미라클은 박스 기준 ACE 1장, AR 3장, RR 평균 4.1장,
SR/SAR/UR 기대값을 모두 더한 뒤 1팩의 마지막 hit 카드 풀로 환산한다.

## 표시 정렬

누적 카드와 요약 배지는 표시 rarity 기준으로 정렬한다.

```txt
MUR -> BWR -> SAR -> UR -> MA -> SR -> ACE -> AR -> RR -> R -> U -> C
```

데이터상 MEGA MUR은 `UR` rarity로 저장되어 있으므로, 정렬 시에는 세트 코드,
이미지 경로, 카드 번호로 MEGA context를 판별해 `MUR`로 먼저 올린다.

## 검증 기준

리팩토링이나 봉입률 변경 후 최소한 아래를 확인한다.

```powershell
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir scripts validate:data -- --set <set-code> --strict
```

추가로 박스 분포를 샘플링해서 확인한다.

- RR은 세 세트 모두 박스당 4장 또는 5장만 나와야 한다.
- 스텔라미라클/낙원드래고나는 ACE가 박스당 1장이어야 한다.
- 배틀파트너즈는 ACE가 나오면 안 된다.
- SR/SAR/UR 합산은 1장 또는 2장이어야 한다.
