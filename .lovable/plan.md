

# 왼쪽 헤더 제목 스타일 수정

HEADER_HEIGHT=30 고정이므로 WORKBOOK 위치는 절대 변하지 않음.

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

| 속성 | 현재 | 변경 |
|------|------|------|
| `styles.title.fontSize` | 16 | 12 |
| `styles.title.fontWeight` | 700 | 800 |
| `styles.header.paddingBottom` | 6 | 2 |

3행만 수정. WORKBOOK 관련 코드 일절 미접촉.

