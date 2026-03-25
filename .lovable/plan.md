

# 드래그 선택 시 위첨자를 선택 영역 첫 단어에 고정

## 문제
"we do"를 드래그하면 위첨자가 "we"에 붙어야 하지만, `chooseAnchorOffset`의 휴리스틱이 "we"를 stopword로 건너뛰고 문법 설명 내 힌트 단어("work")에 매칭하여 엉뚱한 위치에 위첨자를 배치함.

## 변경 사항

### 1. `SyntaxNote` 인터페이스에 `anchorMode` 추가
- **파일**: `src/pages/Index.tsx` (line 53-57)
- `anchorMode?: "heuristic" | "selection-start"` 필드 추가

### 2. 드래그 분석 시 `anchorMode` 설정
- **파일**: `src/pages/Index.tsx` (line 474 부근)
- `selectedText`가 있는 경우(드래그 분석) → `anchorMode: "selection-start"` 저장
- 자동 생성 → `anchorMode: "heuristic"` (기본값)

### 3. `computeSuperscriptPositions`에서 `anchorMode` 반영
- **파일**: `src/lib/syntax-superscript.tsx`
- `SyntaxNoteWithTarget` 인터페이스에 `anchorMode` 추가
- `computeSuperscriptPositions` 내에서 `note.anchorMode === "selection-start"`이면 `chooseAnchorOffset` 호출을 건너뛰고, `span.start`를 anchor로 직접 사용

### 수정 파일 요약
- `src/pages/Index.tsx` — 인터페이스 + 노트 생성 시 anchorMode 설정
- `src/lib/syntax-superscript.tsx` — anchorMode 지원, selection-start 시 span.start 사용

