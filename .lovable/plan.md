

# WORKBOOK 위치 동기화 + BOOK 이격 수정

## 원인

`getArcPoints()`의 `headerHeight = 14`가 title fontSize 8pt 기준값. 16pt로 키운 후 업데이트 안 해서 WORK가 실제 외곽선보다 ~8pt 위에 그려짐.

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1. headerHeight 동기화 (228행)

```
headerHeight = 14 → headerHeight = 26
```

Pretendard 16pt bold 줄높이(~20pt) + header paddingBottom(6pt) = ~26pt. 이렇게 하면 Canvas 좌표가 실제 body 외곽선과 다시 일치함.

### 2. BOOK normalOffset 유지

현재 B=0.6, O=0.8, O=0.8, K=0.8 값은 유지. headerHeight 수정 후 실제 결과를 보고 미세조정 판단.

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | `headerHeight` 14→26 (1행) |

