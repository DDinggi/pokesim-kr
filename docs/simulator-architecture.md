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

## 세트별 박스 모델

한국판 공식 봉입률은 비공개다. 아래 숫자는 일본판 실측/커뮤니티 추정치를
한국판 카드 구성에 맞춰 적용한 모델이다.

### 일반 SV 확장팩

`SR/SAR/UR 슬롯 1장`은 SR 카드가 반드시 1장 나온다는 뜻이 아니다.
SAR나 UR이 나오면 기본 SR은 0장일 수 있다. 2장 박스에서는 추가 SR 슬롯이
붙는 모델로 둔다.

| 세트 | ACE | RR | AR | 고레어 슬롯 | 추가 SR |
| --- | ---: | ---: | ---: | --- | ---: |
| 트리플렛비트 | 0 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 5% |
| 포켓몬 카드 151 | 0 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 변환의 가면 | 1 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 스텔라미라클 | 1 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 낙원드래고나 | 1 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 초전브레이커 | 1 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 배틀파트너즈 | 0 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 열풍의 아레나 | 0 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |
| 로켓단의 영광 | 0 | 4장, 약 10%로 5장 | 3 | SR/SAR/UR 1장 | 약 10% |

블랙볼트/화이트플레어는 20팩 x 7장 특수 구성이다. 현재 모델은 RR 4장,
AR 4장, SR 1장, 추가 SR 약 20%, SAR 약 25%, BWR 약 5%로 둔다.
마스터볼/몬스터볼 미러는 아직 별도 카드 변형 데이터가 없어 시뮬 결과에
표시하지 않는다.

### MEGA 확장팩

MEGA 일반 확장팩은 일반 SV와 다르게 슬롯이 2개로 갈라진다.

| 슬롯 | 모델 |
| --- | --- |
| 비서포트 트레이너즈 SR | 1장 확정 |
| 메인 고레어 | 포켓몬/서포트 SR 70%, SAR 28%, MUR 2% |
| 추가 고레어 | 메인 SR 약 10% |
| RR / AR | RR 4장, 약 10%로 5장 / AR 3장 |

따라서 MEGA 확장팩은 기본적으로 SR 이상이 2장 이상 나온다. SAR/MUR이 나오면
메인 SR 슬롯을 대체하지만, 비서포트 트레이너즈 SR은 별도라 같이 나온다.

### 하이클래스팩

| 세트 | 고정 슬롯 | 추가 슬롯 | 아직 미표현 |
| --- | --- | --- | --- |
| 테라스탈 페스타 ex | RR 9장, 포켓몬 SAR 1장 | SR 20%, 서포트 SAR 10%, UR 6% | 미러 |
| MEGA 드림 ex | RR 9장, AR 3장, 비서포트 트레이너즈 SR 1장, MA 1장 | SR 10%, SAR 40%, MUR 2% | 미러 |

MEGA 드림 ex의 갓팩은 낮은 확률로 한 팩에 AR 1장, MA 5장, SAR 4장을
별도 배치한다. 일반 박스 고정 슬롯을 통째로 없애지 않는다.

출처:

- https://pokemon-infomation.com/pull-rates-tripletbeat/
- https://pokemon-infomation.com/pull-rates-pokemoncard151/
- https://pokemon-infomation.com/pull-rates-hengennokamen/
- https://pokemon-infomation.com/pull-rates-stellamiracle/
- https://pokemon-infomation.com/pull-rates-rakuendoragona/
- https://pokemon-infomation.com/pull-rates-tyodenbraker/
- https://pokemon-infomation.com/pull-rates-battlepartner/
- https://pokemon-infomation.com/pull-rates-neppuuarina/
- https://pokemon-infomation.com/pull-rates-rocketdaneikou/
- https://premium.gamepedia.jp/pokeca/archives/13368
- https://altema.jp/pokemoncard/whiteflare
- https://pokemon-infomation.com/pull-rates-ninjaspiner/
- https://pokemon-infomation.com/pull-rates-megadreamex/

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

- 일반 SV 30팩/151은 RR이 박스당 4장 또는 5장만 나와야 한다.
- 변환의 가면/스텔라미라클/낙원드래고나/초전브레이커는 ACE가 박스당 1장이어야 한다.
- 블랙볼트/화이트플레어는 RR 4장, AR 4장, SR 평균 약 1.2장이어야 한다.
- MEGA 일반 확장팩은 RR 4~5장, AR 3장, 비서포트 트레이너즈 SR 1장이 나와야 한다.
- MEGA 드림 ex는 RR 9장, MA 1장, 비서포트 트레이너즈 SR 1장이 기본이다.
- 미러/151 특수팩처럼 미구현 변형은 샘플링 검증 대상에서 제외하고 별도 이슈로 남긴다.
