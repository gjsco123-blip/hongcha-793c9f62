

## PDF 위첨자 매칭 로직 수정

### 문제 원인
현재 `renderChunksWithVerbUnderline` 함수에서 `fullText`를 청크들을 `" / "`로 join해서 만들고, 그 텍스트에서 `targetText`를 검색함. 하지만 사용자가 드래그한 `targetText`는 원문(`result.original`) 기준이라 `" / "` 구분자가 없는 텍스트임. 이 때문에 위치가 3글자씩 밀려서 엉뚱한 곳에 위첨자가 붙음.

### 해결 방법
`renderChunksWithVerbUnderline`에 `original` 텍스트를 추가 파라미터로 전달하고, `targetText` 매칭은 원문 기준으로 수행한 뒤, 그 위치를 청크 세그먼트에 매핑.

### 변경 내용 (`src/components/PdfDocument.tsx`)

1. `renderChunksWithVerbUnderline` 함수 시그니처에 `original: string` 파라미터 추가
2. 위치 매핑 로직 변경:
   - `fullText`를 `" / "` 없이 (공백 없이 이어 붙여서가 아니라) 원문 기준으로 매칭
   - 원문에서 `targetText`의 시작 위치를 찾음
   - 세그먼트 위치 맵을 `" / "` 구분자 없이 빌드하여, 원문 기준 offset과 일치시킴
3. `SentenceBlock`에서 호출 시 `result.original`을 함께 전달

```
변경 전: renderChunksWithVerbUnderline(result.englishChunks, result.syntaxNotes)
변경 후: renderChunksWithVerbUnderline(result.englishChunks, result.syntaxNotes, result.original)
```

핵심: 세그먼트 position map에서 `" / "` (3글자)를 더하지 않고 원문 기준의 연속된 오프셋으로 계산하면, `targetText` 매칭이 정확해짐.

### 변경 파일
- `src/components/PdfDocument.tsx` — 함수 시그니처 + 매칭 로직 + 호출부

