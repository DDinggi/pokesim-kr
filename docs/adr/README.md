# ADR (Architecture Decision Records)

깊은 의사결정 이유 기록. 10주차 폴리싱 단계에서 한꺼번에 작성.

상세는 AGENTS.md 의 [부록: 새 결정 추가 가이드] 참고.

## 작성 예정 (우선순위 순)

- [ ] 0001-static-mvp-decision.md — MVP를 정적 사이트로 시작한 이유
- [ ] 0002-progressive-backend-introduction.md — 백엔드 도입 트리거 시스템
- [ ] 0003-cloudflare-r2-vs-s3.md — 이미지 호스팅 결정
- [ ] 0004-redis-counter-pattern.md — 통계 집계 전략
- [ ] 0005-client-side-simulation.md — 시뮬을 클라이언트에서
- [ ] 0006-github-actions-as-cron.md — 별도 인프라 없이 스케줄러
- [ ] 0007-no-c2c-crawling.md — C2C 크롤링 안 한 이유
- [ ] 0008-holo-effect-from-scratch.md — 라이브러리 안 쓰고 직접 구현
- [ ] 0009-luck-score-algorithm.md — 럭 점수 알고리즘 (-log10 기반)
- [ ] 0010-precomputed-distribution.md — 사전 시뮬 분포 활용
- [ ] 0011-three-way-probability.md — 표시 확률 + 출처 메타
- [ ] 0012-og-image-generation.md — 공유 이미지 생성 전략
- [ ] 0013-price-as-secondary.md — 시세를 차별화에서 보조로
- [ ] 0014-partial-auth-boundary.md — 시뮬 익명 / 리뷰 로그인
- [ ] 0015-session-hybrid.md — Redis 캐시 + DB 백업 세션
- [ ] 0016-review-2-axis.md — 리뷰 축 2개 (실용성 제외)
- [ ] 0017-box-unit-simulation.md — 박스 단위 시뮬을 메인으로

## ADR 템플릿

```markdown
# ADR-NNNN: 제목

## 상태
승인됨 (2025-MM-DD)

## 컨텍스트
어떤 상황에서 이 결정을 했는가. 어떤 제약이 있었는가.

## 검토한 옵션

### 옵션 A: ...
- 장점:
- 단점:
- 비용:

### 옵션 B: ...
- 장점:
- 단점:
- 비용:

## 결정
옵션 X를 선택.

## 근거
왜 X인가. 무엇을 우선했는가.

## 트레이드오프
이 결정으로 포기한 것.

## 결과
시간이 지난 후 검증 (있으면).
```
