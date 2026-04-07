

# 워크북 PDF 격자가 텍스트 위에 렌더링되는 문제 수정

## 원인

`@react-pdf/renderer`는 **`zIndex`를 안정적으로 지원하지 않음**. 현재 `gridLayer`에 `zIndex: 0`, `contentLayer`에 `zIndex: 2`를 설정했지만, react-pdf에서는 이 속성이 무시되는 경우가 많아 격자가 텍스트 위에 그려지는 현상 발생.

## 해결 방법 (`src/components/WorkbookPdfDocument.tsx`)

`zIndex`에 의존하지 않고, **레이아웃 구조 자체**로 순서를 보장:

1. **gridLayer와 contentLayer 모두 `position: absolute`를 유지**하되, `zIndex` 속성을 모두 제거
2. **JSX 렌더링 순서를 gridLayer → contentLayer로 유지** (react-pdf는 나중에 렌더링된 요소가 위에 옴)
3. **contentLayer에 불투명 배경 없음 확인** (투명해야 격자가 비침)
4. **textLayer에서도 `zIndex` 제거**

핵심: react-pdf에서는 DOM 순서가 곧 z-order. `zIndex` 프로퍼티를 제거하고 순서만으로 해결.

### 변경 요약

```text
gridLayer:  zIndex: 0  → 삭제
contentLayer: zIndex: 2 → 삭제  
textLayer: zIndex: 2    → 삭제
analysisSection: zIndex: 3 → 삭제
body: backgroundColor: "#fff" → 유지 (배경색은 body에만)
```

격자 SVG의 배경을 투명하게 유지하고, `body`의 `backgroundColor: "#fff"`가 가장 뒤에서 흰 배경 역할.

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | 모든 `zIndex` 제거, DOM 순서로 레이어링 보장 |

