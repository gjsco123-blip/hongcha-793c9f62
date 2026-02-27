

## 원인 분석

페이지네이션 로직(`paginateResults`)에 3가지 과대 추정이 있어서, 실제로는 공간이 남는데도 문장을 다음 페이지로 밀어냄:

1. **`engLines` 계산: 55자/줄** — MEMO 열(100pt)을 빼도 본문 가용 폭에서 실제 약 65-70자가 들어감. 55자 기준이면 줄 수를 ~25% 과대 추정
2. **`HEADER_H = 54`** — 실제 PdfHeader는 titleBox(22) + rule(1.5) + ruleOffset(5.5) + marginBottom(16) - marginTop(14) ≈ 31pt. 54pt는 약 23pt 과대
3. **`PASSAGE_H = 90`** — TEXT ANALYSIS 섹션이 마지막 페이지에만 필요한데, 마지막 문장 추가 시점에 90pt를 차감. 실제 필요 높이는 문장 수에 따라 다르지만 대부분 60-70pt면 충분

결과: 1페이지 가용 높이를 `841.89 - 82 - 54 = 705.89pt`로 계산하지만, 실제는 `841.89 - 82 - 31 = 728.89pt`. 여기에 각 문장 높이도 과대 추정되니 4번 문장이 넘침.

## 수정 계획

**파일**: `src/components/PdfDocument.tsx`

1. `estimateSentenceHeight` 조정:
   - `engLines`: `Math.ceil(len / 55)` → `Math.ceil(len / 70)`
   - `rowH`: `13` → `12`

2. `paginateResults` 상수 조정:
   - `HEADER_H`: `54` → `36` (PdfHeader 실측 기반)
   - `PASSAGE_H`: `90` → `70`

3. `PASSAGE_H` 차감 로직 개선:
   - 현재: 마지막 문장(`isLastResult`)일 때만 차감 → 남은 문장 전체가 현재 페이지에 들어갈 수 있는지도 고려하도록 변경

