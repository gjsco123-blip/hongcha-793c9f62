

## 페이지네이션 마지막 문장 높이 과다 계산 수정

### 원인
`estimateSentenceHeight(results[i], false)` — 두 번째 인자가 항상 `false`여서, 해당 문장이 페이지의 마지막 문장이 되더라도 구분선 여백 22pt(marginBottom 14 + paddingBottom 8)가 항상 포함됨. 실제 렌더링에서는 페이지 마지막 문장의 구분선이 제거되므로 22pt 과다 추정.

### 수정 방법

**`src/components/PdfDocument.tsx`** — `paginateResults` 함수 (line 379~410)

현재 로직: `h = estimateSentenceHeight(results[i], false)` 고정값으로 overflow 판단

수정 로직: overflow 판단 시 **해당 문장이 페이지 마지막이 될 경우의 높이**(`isLast=true`, 22pt 절약)로도 체크. 즉:

1. `hFull = estimateSentenceHeight(results[i], false)` — 구분선 포함 높이
2. `hLast = estimateSentenceHeight(results[i], true)` — 구분선 없는 높이
3. overflow 판단 시: `usedHeight + hLast > pageCapacity - passageReserve`이면 진짜 넘침 → 다음 페이지로
4. 안 넘치면 현재 페이지에 추가, `usedHeight`에는 `hFull` 사용 (다음 문장이 올 수 있으므로)

이렇게 하면 페이지 마지막 문장의 불필요한 22pt 여백이 제거되어, 실제 여유 공간이 있으면 같은 페이지에 수용됨.

**`src/pages/Index.tsx`** — 동일한 웹 미리보기 페이지네이션 로직이 있다면 같은 패턴 적용.

### 변경 파일
- `src/components/PdfDocument.tsx` — `paginateResults` 함수 overflow 판단 로직 수정
- `src/pages/Index.tsx` — 웹 미리보기 동기화 (동일 로직 존재 시)

