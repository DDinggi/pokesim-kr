# ADR (Architecture Decision Records)

깊은 의사결정 이유 기록용 폴더. 현재 개별 ADR 파일은 아직 작성하지 않았다.

**의사결정의 단일 출처(SSOT)는 [AGENTS.md](../../AGENTS.md) §11 "의사결정 인덱스"** (D-NNN 한 줄 요약).
새 결정 추가 절차는 AGENTS.md "부록: 새 결정 추가 가이드" 참고.

## 작성 후보 (실제 구현 기준)

> 초기 후보 목록에는 FastAPI/Redis/세션 등 채택되지 않은 백엔드 결정이 섞여 있었다.
> 그 계획의 전말은 [docs/archive/original-backend-plan.md](../archive/original-backend-plan.md)에 정리.

실제로 글로 풀 가치가 있는 결정(쓰면 포트폴리오에 도움):

- [ ] 0001-static-client-side-sim.md — 시뮬/운 계산을 전부 클라이언트에서 (서버 비용 0)
- [ ] 0002-supabase-over-custom-backend.md — FastAPI+Fly.io+Neon+Redis 계획 → Supabase 한 방으로 피벗한 이유
- [ ] 0003-cloudflare-r2-image-cdn.md — 이미지 호스팅 + WebP variant 결정 (벤치마크: `docs/benchmarking.md`)
- [ ] 0004-client-side-simulation.md — 시드 기반 시뮬(seedrandom)과 공유 검증
- [ ] 0005-holo-effect-from-scratch.md — 홀로 효과 직접 구현 (회고: `docs/debug-holo-card-transform.md`)
- [ ] 0006-luck-score-algorithm.md — 운 점수(-log10 기반) + 시세 운(가치 운)
- [ ] 0007-no-c2c-crawling.md — C2C 크롤링 안 한 이유 (D-030)
- [ ] 0008-transparent-estimated-rates.md — 공식 비공개 봉입률을 추정치로 투명하게 (D-034)

## ADR 템플릿

```markdown
# ADR-NNNN: 제목

## 상태
승인됨 (YYYY-MM-DD)

## 컨텍스트
어떤 상황에서 이 결정을 했는가. 어떤 제약이 있었는가.

## 검토한 옵션

### 옵션 A: ...
- 장점 / 단점 / 비용

### 옵션 B: ...
- 장점 / 단점 / 비용

## 결정
옵션 X를 선택.

## 근거
왜 X인가. 무엇을 우선했는가.

## 트레이드오프
이 결정으로 포기한 것.

## 결과
시간이 지난 후 검증 (있으면).
```
