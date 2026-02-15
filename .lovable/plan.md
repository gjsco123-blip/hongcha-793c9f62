

## PDF 수정: 숫자 정렬 + 영어 글씨체 변경

### 1. 숫자-영어문장 정렬 수정

**파일:** `src/components/PdfDocument.tsx`

현재 `sentenceRow` 스타일에 `alignItems: "center"`가 설정되어 있어서, 영어 문장이 여러 줄로 넘어갈 때 숫자가 세로 중앙에 위치함. 이를 `alignItems: "flex-start"`로 변경하여 숫자가 첫 줄과 같은 높이에 오도록 수정.

또한 `sentenceNumber`의 `marginTop`을 약간 추가하여 텍스트 첫 줄과 시각적으로 정렬되도록 미세 조정.

### 2. 영어 글씨체를 Pretendard로 변경

**파일:** `src/components/PdfDocument.tsx`

- 기존 `Noto Serif` 폰트 등록을 `Pretendard` 폰트 등록으로 교체
- CDN 출처: `https://cdn.jsdelivr.net/gh/Project-Noonnu/noonfonts_2107@1.1/Pretendard-Regular.woff` (react-pdf는 ttf/otf를 선호하므로 적합한 ttf URL 사용)
- `englishText` 스타일의 `fontFamily`를 `"Pretendard"`로 변경
- `passageText`, `verbUnderline` 등 영어 텍스트에 적용되는 모든 스타일도 동일하게 변경

### 수정 요약

| 위치 | 변경 내용 |
|------|-----------|
| `sentenceRow.alignItems` | `"center"` → `"flex-start"` |
| 폰트 등록 | `Noto Serif` → `Pretendard` (ttf CDN) |
| `englishText.fontFamily` | `"Noto Serif"` → `"Pretendard"` |
| `passageText.fontFamily` | `"Noto Serif"` → `"Pretendard"` |

