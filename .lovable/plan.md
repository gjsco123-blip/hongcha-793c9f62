
# Vocabulary 3열 가로 배치 수정

## 문제
현재 30개 단어가 2열(1-10, 11-20)까지만 가로로 나오고, 21-30은 아래로 떨어져서 표시됨. 사용자가 원하는 것은 1-10 / 11-20 / 21-30 이 모두 가로로 나란히 배치되는 것.

## 변경 사항

### 1. 웹 UI (`src/pages/Preview.tsx`)
- 그리드를 `grid-cols-1 md:grid-cols-3`으로 변경하여 md 이상에서 항상 3열 표시
- 열 간 간격(`gap-x`)을 6에서 4로 줄여 더 콤팩트하게
- Word 열의 `min-w`를 70px에서 60px로 줄여 3열에 맞게 조정

### 2. PDF (`src/components/PreviewPdf.tsx`)
- `vocabRow2Col`의 `gap`을 20에서 12로 줄여 3열이 A4 폭에 맞도록 조정
- `vWord` 너비를 68에서 58로 축소
- `vNum` 너비를 18에서 16으로 축소
- `vPos` 너비를 22에서 18로 축소

## 기술 세부사항
- 웹: `md:grid-cols-2 lg:grid-cols-3` -> `md:grid-cols-3`으로 변경하여 태블릿 크기부터 3열 적용
- PDF: react-pdf는 flexbox 기반이므로 `flex: 1`이 이미 3등분을 처리하며, gap과 셀 너비만 축소하면 됨
