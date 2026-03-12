

# PDF 페이지네이션 상수 보정 실행

이전에 승인된 변경사항을 `src/lib/pdf-pagination.ts`에 적용합니다.

## 변경 내용 (3줄)

| 상수 | 현재값 | 변경값 | 이유 |
|------|--------|--------|------|
| `ENG_CHARS_PER_LINE` | 68 | **88** | 실제 PDF 렌더링 측정값 반영 |
| `TRANS_CHARS_PER_LINE` | 62 | **68** | 한글 6.5pt 실측 반영 |
| `PACKING` | 0.92 | **0.85** | 1페이지 채움 극대화, `wrap={false}`가 안전망 |

## 파일
- `src/lib/pdf-pagination.ts` — 53~60행의 3개 상수값만 수정

