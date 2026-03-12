

# PDF 레이아웃 2건 수정

## 수정 1: MEMO 컬럼 absolute 포지셔닝

**파일**: `src/components/PdfDocument.tsx`

- `contentRow` 스타일에 `position: "relative"` 추가
- `memoColumn` 스타일을 `position: "absolute", top: 0, bottom: 0, right: 0`으로 변경
- `leftColumn`에 `paddingRight: GAP + MEMO_WIDTH`로 오른쪽 여백 확보 (MEMO 영역과 겹치지 않도록)

## 수정 2: 페이지네이션 상수 재보정

**파일**: `src/lib/pdf-pagination.ts`

| 상수 | 현재값 | 변경값 | 이유 |
|------|--------|--------|------|
| `TRANS_CHARS_PER_LINE` | 68 | **75** | 6.5pt 한글 실측 반영, 높이 과다 추정 해소 |

이 두 수정으로 (1) MEMO가 항상 마지막 문장 하단에 정렬되고, (2) 문장 05+06이 2페이지에 함께 수용됩니다.

