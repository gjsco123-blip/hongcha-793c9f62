

## 세 가지 수정 사항

### 1. 밑줄 정렬 수정 (ChunkEditor.tsx)
- 동사 단어의 `px-0.5 -mx-0.5` 패딩/마진 제거
- `underline-offset-2` → `underline-offset-[3px]`로 조정
- 밑줄이 단어 첫 글자와 정확히 맞도록 함

### 2. 밑줄 정렬 통일 (ResultDisplay.tsx)
- `underline-offset-[3px]`로 통일

### 3. 섹션 제목 변경 (PdfDocument.tsx)
- "지문" → "Original Passage"로 변경

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| src/components/ChunkEditor.tsx | 동사 단어 패딩 제거, underline-offset 조정 |
| src/components/ResultDisplay.tsx | underline-offset 통일 |
| src/components/PdfDocument.tsx | 섹션 제목 "지문" → "Original Passage" |

간단한 스타일/텍스트 수정 3건입니다.

