# 홀로카드 3D 틸트 효과 디버깅 회고

> 카드 모달의 홀로그래픽 효과(simeydotme/pokemon-cards-css 스타일)를 구현하는데 마우스를 움직여도 카드가 전혀 안 움직이는 문제를 4시간 동안 디버깅한 기록.

## TL;DR

**진짜 원인**: `globals.css`에 `@media (prefers-reduced-motion: reduce) { .holo-card { transform: none !important } }` 규칙이 있었고, Windows 11의 "애니메이션 효과 줄이기" 설정이 켜져 있어서 미디어 쿼리가 활성화 → `!important`가 inline style을 이겨서 transform이 매번 무력화됨.

**JS 쪽에는 처음부터 문제가 없었음.** 4시간 동안 잘못된 곳을 들여다봤음.

## 증상

- 모달의 카드 위에 마우스 올림 → 커서 모양은 십자선(`cursor: crosshair`)으로 변함 (CSS 적용은 됨)
- 마우스를 카드 위에서 움직임 → DOM의 inline `transform: rotateY(20deg)...` 값은 실시간 변함
- 그런데 **시각적으로 카드가 전혀 안 기울어짐**
- 콘솔에서 `document.querySelector('.holo-card').style.transform = 'rotateY(45deg) scale(1.5)'` 직접 실행해도 안 변함

## 디버깅 여정 (잘못 들어간 길들)

| # | 가설 | 시도한 것 | 결과 |
|---|------|----------|------|
| 1 | `mix-blend-mode: color-dodge`가 어두운 카드에서 안 보임 | `screen`으로 변경 | 무관 |
| 2 | React 합성 이벤트 위임 문제 | 네이티브 `addEventListener` | 무관 |
| 3 | `requestAnimationFrame` 타이밍 이슈 | rAF 제거, 동기 DOM 업데이트 | 무관 |
| 4 | 이미지 드래그가 mousemove 가로챔 | `draggable={false}` + 캡처 div | 무관 |
| 5 | `mousemove` 대신 `pointermove` 써야 함 | pointer events로 변경 | 무관 |
| 6 | parent의 `perspective` property가 안 먹힘 | `transform: perspective(800px) ...` 함수형으로 self-contained | 무관 |
| 7 | `mouseleave`가 빠르게 발생해서 reset됨 | window mousemove + 좌표 판정 | 무관 |

각 가설마다 부분 진실이 있어서 "이거다!" 싶었는데 실제로는 모두 헛짚음.

## 결정적 진단

전체 디버깅의 분기점:

```js
// 콘솔에서 직접 실행 (마우스 이벤트와 무관)
document.querySelector('.holo-card').style.transform = 'perspective(800px) rotateY(45deg) scale(1.5)'
```

→ **이게 안 변했음**.

이 시점에 깨달음: 문제는 JS도 아니고 mouse 이벤트도 아니고, **inline transform 자체가 시각적으로 적용되지 않음**.

inline style은 CSS 명세상 거의 모든 규칙을 이긴다. 이걸 이길 수 있는 건 단 하나, **`!important`가 붙은 CSS 규칙**.

## 진짜 원인

```css
/* globals.css 끝부분 — 이전에 추가한 코드 */
@media (prefers-reduced-motion: reduce) {
  .holo-card {
    transform: none !important;  /* ← 범인 */
  }
  .holo-layer,
  .holo-glare {
    display: none;
  }
}
```

작업하던 PC의 Windows 11 설정에서 **"애니메이션 효과"가 꺼져 있었음**. 그래서 브라우저는 `prefers-reduced-motion: reduce`로 판정 → 위 미디어 쿼리 활성화 → `.holo-card`의 모든 transform이 `!important`로 강제 무효화.

inline `style="transform: ..."`도, JS의 `el.style.transform = ...`도, 콘솔의 직접 적용도 전부 이 규칙에 막힘.

## 해결

```css
@media (prefers-reduced-motion: reduce) {
  /* 박스 reveal/팩 shimmer 같은 자동 애니메이션은 reduced-motion에서 비활성화 유지 */
  .card-reveal, .card-reveal-hit { animation: none; }
  .pack-shimmer, .burst-rays, .pokeball-spin, .loading-bounce { animation: none; }
  /* 단, 홀로카드 효과는 사용자가 의도해서 마우스를 올리는 인터랙션이므로
     reduced-motion에서도 유지 (transform: none !important 규칙 제거) */
}
```

## 교훈

1. **inline style이 안 먹히면 무조건 `!important`를 의심**. CSS 명세상 이게 유일한 가능성.
2. `prefers-reduced-motion: reduce`는 OS 설정이라 dev PC 환경에 따라 활성/비활성. 한 번 무력화 규칙을 넣어두면 며칠 뒤 본인이 이 함정에 걸린다.
3. 사용자 의도 인터랙션(클릭/마우스 위치)에 반응하는 효과는 reduced-motion에서 켜둬도 무방. **자동으로 움직이는 애니메이션만** 비활성화하는 게 prefers-reduced-motion의 본래 목적.
4. 디버깅 분기점을 빨리 찾는 질문: **"가장 강력한 방법으로 강제 적용해도 안 되면, 누가 막고 있나?"** 콘솔에서 직접 inline style 적용해서 확인하는 게 30분 만에 답을 줬을 것.
5. 4시간 디버깅을 30분으로 줄이는 체크리스트:
   - [ ] `getComputedStyle(el).transform` 결과가 `none`이면 → CSS 충돌
   - [ ] `getComputedStyle(el).transform` 결과가 `matrix(...)`인데 시각적 변화 없음 → ancestor 컴포지팅/clip 문제
   - [ ] inline style 직접 적용해도 안 되면 → `!important` 규칙 존재 의심

## 최종 코드 (요약)

### `frontend/components/CardModal.tsx`
```tsx
useEffect(() => {
  if (!isHolo) return;
  const el = rotatorRef.current;
  if (!el) return;
  let inside = false;

  function onMove(e: MouseEvent) {
    const rect = el!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    if (px >= 0 && px <= 1 && py >= 0 && py <= 1) {
      inside = true;
      el!.style.setProperty('--mx', String(px));
      el!.style.setProperty('--my', String(py));
      el!.style.setProperty('--active', '1');
      el!.style.transform = `perspective(800px) rotateY(${(px - 0.5) * 25}deg) rotateX(${-(py - 0.5) * 25}deg) scale(1.05)`;
      el!.style.transition = 'transform 80ms linear';
    } else if (inside) {
      inside = false;
      el!.style.setProperty('--active', '0');
      el!.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
      el!.style.transition = 'transform 600ms ease-out';
    }
  }

  window.addEventListener('mousemove', onMove);
  return () => window.removeEventListener('mousemove', onMove);
}, [isHolo]);
```

### `frontend/app/globals.css` (핵심)
```css
.holo-card {
  --mx: 0.5;
  --my: 0.5;
  --active: 0;
  will-change: transform;
  cursor: crosshair;
  isolation: isolate;
  /* transform/transition은 JS가 inline으로 제어 */
}

/* prefers-reduced-motion에서 transform: none !important 제거됨 */
```

## 작동 원리

- `perspective(800px)`을 transform 함수 첫 번째에 넣어서 self-contained 3D 컨텍스트 생성 (parent의 perspective property에 의존 X)
- `--mx`, `--my` (0~1 비율) → 등급별 `.holo-sar`, `.holo-ar` 등의 radial gradient `at calc(var(--mx) * 100%) ...` 위치로 사용
- `--active: 0/1` → `.holo-layer { opacity: var(--active) }`로 shimmer 페이드 in/out
- `mouseleave` 대신 window `mousemove` + 좌표 판정 → 일부 환경에서 mouseleave 빠른 발생 이슈 우회
