

## 분석: 높이 과다 추정으로 인한 페이지 넘침

### 원인

`estimateSentenceHeight`에서 번역 행(직역/의역/홍T/구문) 높이를 계산할 때 `TRANS_LINE_H = 6.5 * 1.8 = 11.7pt`를 사용합니다. 하지만 react-pdf에서 마지막 행의 lineHeight 여백(하단 leading)은 실제로 다음 행과의 간격 역할이며, 마지막 행 이후에는 불필요합니다. 

또한 각 행마다 `TRANS_ROW_GAP = 3pt`가 추가되는데, 마지막 번역 행의 3pt도 실제로는 불필요한 여백입니다.

문장 4개에 각각 직역+의역+홍T+구문(1~3개) = 약 5~7개 번역 행이면, **전체 20+ 번역 행** 존재. 행당 ~1pt만 과다 추정해도 **20pt 이상** 누적됩니다.

### 해결 방법

두 파일의 번역 행 높이 상수를 실제 렌더링에 가깝게 조정:

**`src/components/PdfDocument.tsx`** — `estimateSentenceHeight`:
- `TRANS_LINE_H`: `6.5 * 1.8 = 11.7` → `6.5 * 1.65 = 10.725` (행당 ~1pt 절약)
- `TRANS_ROW_GAP`: `3` → `2` (마지막 행 여백 과다 보정)

**`src/pages/Index.tsx`** — `pageBreakInfo` 계산:
- `TRANS_LINE_H`: `6 * 1.6 = 9.6` → `6.5 * 1.65 = 10.725` (PdfDocument와 동기화)
- `TRANS_ROW_GAP`: `3` → `2`

### 절약 효과 (4문장, 약 20개 번역 행 기준)

| 항목 | 절약/행 | 총 절약 |
|------|---------|---------|
| TRANS_LINE_H 감소 | ~1pt | ~20pt |
| TRANS_ROW_GAP 감소 | 1pt | ~20pt |
| **합계** | | **~40pt** |

40pt면 문장 4가 1페이지에 충분히 들어갈 수 있습니다.

### 변경 파일
- `src/components/PdfDocument.tsx` — TRANS_LINE_H, TRANS_ROW_GAP 상수 2개 조정
- `src/pages/Index.tsx` — 동일 상수 동기화

