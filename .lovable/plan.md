

# 헤더 제목 위치 조정 + headerHeight 분리

## 문제 원인

`getArcPoints()` 233행:
```
const bodyTop = pagePadTop + headerHeight;
```

`headerHeight`가 제목 크기에 맞춰 수동으로 설정되기 때문에, 제목 크기를 바꿀 때마다 WORKBOOK 경로가 틀어진다. **분리된 게 아니라 하드코딩으로 연결되어 있다.**

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1. headerHeight를 제목과 무관하게 고정

WORKBOOK 경로의 기준점은 **body View의 실제 시작 위치**여야 한다. body View는 `pagePadTop`(30pt) 바로 아래에서 시작하므로, headerHeight는 사실 **0**이어야 맞다 — 헤더는 body 안에 있고, WORKBOOK도 body 외곽선을 따라가기 때문.

현재 구조: 헤더가 body 외부가 아니라 **body 내부**(`contentLayer` 안)에 있다. 따라서:

```typescript
const bodyTop = pagePadTop; // headerHeight 제거 — body는 pagePadTop에서 시작
```

이렇게 하면 제목 크기와 WORKBOOK이 완전히 분리된다.

### 2. 제목을 외곽선에 최대한 붙이기

현재 `contentLayer.paddingTop: 18` → **10**으로 줄여서 제목을 외곽선 상단에 가깝게 배치.

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | `bodyTop` 계산에서 `headerHeight` 제거 (1행), `contentLayer.paddingTop` 18→10 (1행) |

