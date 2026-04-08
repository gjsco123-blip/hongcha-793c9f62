

# BOOK 외곽선 이격 + 제목 크기 변경

## 현재 상태

- W O R K는 외곽선과 적절한 간격 유지 (OK)
- B O O K는 외곽선에 **딱 붙어** 있음 → 밀어내야 함
- 제목 fontSize가 8pt로 작음

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1. `LETTER_METRICS` normalOffset — 양수 = 바깥으로 밀기

| idx | 글자 | normalOffset | 변경 |
|-----|------|-------------|------|
| 0 | W | 0 | 유지 |
| 1 | O | 0 | 유지 |
| 2 | R | 0 | 기준 |
| 3 | K | 0 | 유지 |
| 4 | B | 0.6 | 바깥으로 밀기 |
| 5 | O | 0.8 | 바깥으로 밀기 |
| 6 | O | 0.8 | 바깥으로 밀기 |
| 7 | K | 0.8 | 바깥으로 밀기 |

### 2. 제목 fontSize

`styles.title.fontSize`: 8 → 16

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | LETTER_METRICS normalOffset 4행 + title fontSize 1행 |

