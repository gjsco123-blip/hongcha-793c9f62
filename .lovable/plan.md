

## 변경 계획

**파일:** `src/components/PdfDocument.tsx`

1. **헤더 하단 분리 줄 (488-495줄) 삭제** — `marginTop: 12`로 감싼 회색/검은 줄 View 전체 제거
2. **`styles.header`의 `marginBottom` 줄이기** — 현재 `24` → `8` 정도로 줄여서 title/subtitle과 본문 사이 간격을 최소화하고, 문장과 MEMO가 더 위에서 시작하도록 함
3. **`styles.header`의 `paddingBottom` 제거** — 현재 `12` → `0`으로 변경

결과: title/subtitle 바로 아래에서 01번 문장과 MEMO가 시작됨.

