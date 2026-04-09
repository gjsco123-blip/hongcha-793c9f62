

# WORKBOOK 전체 외곽선 간격 통일

## 현재 상태

- `OOK`: normalOffset 0.8 → 외곽선에서 적절히 떨어져 있음 (이게 목표 간격)
- `WORKB`: normalOffset 0~0.6 → 외곽선에 붙어 있음
- 헤더와 Canvas 좌표는 `headerHeight` 상수로만 연결, 실제 View와 독립 (분리 완료)

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### LETTER_METRICS normalOffset 통일

모든 글자를 `OOK`와 같은 0.8로 맞춤. 상단 직선의 `W/O/R`은 normal 방향이 위쪽이라 0.8이면 충분. 코너의 `K/B`도 0.8로 올림.

```typescript
const LETTER_METRICS = [
  { char: "W", normalOffset: 0.8, tangentOffset: 0 },
  { char: "O", normalOffset: 0.8, tangentOffset: 0 },
  { char: "R", normalOffset: 0.8, tangentOffset: 0 },
  { char: "K", normalOffset: 0.8, tangentOffset: 0 },
  { char: "B", normalOffset: 0.8, tangentOffset: 0 },
  { char: "O", normalOffset: 0.8, tangentOffset: 0 },
  { char: "O", normalOffset: 0.8, tangentOffset: 0 },
  { char: "K", normalOffset: 0.8, tangentOffset: 0 },
];
```

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | LETTER_METRICS normalOffset 5행 변경 |

