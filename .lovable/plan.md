

## PDF 위첨자 위치 오류 — 근본 원인 분석 및 수정 계획

### 근본 원인

**세그먼트 단위 매칭의 한계가 문제.**

예시 문장의 chunk 2: `"where the jumbo-sized portions are consistently 250 percent larger than the regular portions."`

이 청크의 segments:
- seg 0: `"where the jumbo-sized portions "` (일반 텍스트)
- seg 1: `"are"` (동사, 밑줄)
- seg 2: `" consistently 250 percent larger than the regular portions."` (일반 텍스트)

사용자가 `"larger than"`을 드래그하면, 현재 코드는:
1. chunk.text에서 `"larger than"`의 시작 위치(idx=60)를 찾음
2. 그 idx가 어떤 세그먼트에 속하는지 확인 → seg 2 (범위 34~93)에 해당
3. **seg 2 전체 앞에** 위첨자 숫자를 삽입

결과: `²consistently 250 percent larger than...` ← "consistently" 앞에 위첨자가 붙음. "larger than" 앞이 아님.

**웹 UI가 정확한 이유:** `renderWithSuperscripts()`는 원문 문자열에서 정확한 문자 위치에 superscript를 삽입함. 세그먼트 단위가 아님.

**PDF가 틀리는 이유:** `renderChunksWithVerbUnderline()`은 세그먼트 단위로만 위첨자를 배치할 수 있어서, targetText가 세그먼트 중간에서 시작하면 세그먼트 시작점으로 밀려남.

### 수정 방법

`superscriptMap`에 세그먼트 내 오프셋 정보를 추가하고, 렌더링 시 세그먼트 텍스트를 분할하여 정확한 위치에 위첨자를 삽입.

### 변경 내용 (`src/components/PdfDocument.tsx`)

1. **`superscriptMap` 타입 변경:**
   - 기존: `Map<string, number>` (ci-si → noteId)
   - 변경: `Map<string, { id: number; offset: number }>` (ci-si → { noteId, 세그먼트 내 시작 오프셋 })

2. **매칭 로직에 오프셋 저장:**
   ```
   // idx가 세그먼트 내 위치
   const offsetInSeg = idx - segCursor;
   superscriptMap.set(`${ci}-${si}`, { id: ann.id, offset: offsetInSeg });
   ```

3. **렌더링 로직에서 세그먼트 분할:**
   - offset이 0이면 기존처럼 세그먼트 앞에 위첨자
   - offset > 0이면 세그먼트 텍스트를 `text.slice(0, offset)` + 위첨자 + `text.slice(offset)`으로 분할
   - verb 세그먼트에서도 동일 로직 적용

### 변경 파일
- `src/components/PdfDocument.tsx` — superscriptMap 타입 + 오프셋 저장 + 렌더링 분할 로직

