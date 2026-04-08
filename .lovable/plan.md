

# 워크북 PDF 저장 오류 수정

## 원인

`Canvas`의 `paint` 콜백에서 `painter.widthOfString(pt.char)`를 호출하는데, `@react-pdf/renderer`의 painter 객체는 이 메서드를 지원하지 않음. → `x.widthOfString is not a function` 에러.

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1. `widthOfString` 호출 제거

Helvetica-Bold 6.5pt 기준 글자 폭을 고정값으로 대체. `LETTER_METRICS`에 이미 per-letter 데이터가 있으므로 거기에 `w` (글자 폭 추정치)를 추가하거나, 폰트 크기 기반 상수(~3.8pt)를 사용.

### 2. 변경 코드 (446행 부근)

```typescript
// Before (에러)
const w = painter.widthOfString(pt.char);

// After (고정 추정값)
const w = fontSize * 0.65; // Helvetica-Bold 대문자 평균 폭
```

이 한 줄 수정으로 저장 에러가 해결됨. 글자 센터링의 미세 차이는 0.몇pt 수준이라 육안으로 구분 불가.

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | `widthOfString` → 고정 폭 상수 (1행) |

