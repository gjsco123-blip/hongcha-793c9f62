

# 구문분석 노트 자동 순서 정렬

## 문제
수동으로 구문분석을 추가하면 마지막 번호로 붙는데, 실제 문장에서의 등장 순서와 맞지 않음. 예: "call A B" 구문이 문장에서 2번째로 등장하지만 3번으로 추가됨.

## 해결
구문분석 노트가 변경될 때마다 (추가/삭제/자동생성 후) `targetText`의 문장 내 등장 위치를 기준으로 자동 정렬하고 번호를 재부여.

## 구현

### 정렬 유틸 함수 생성 (`src/lib/syntax-superscript.tsx`)
- `reorderNotesByPosition(notes, originalText)` 함수 추가
- 각 노트의 `targetText`를 원문에서 `indexOf`로 위치 찾기
- 위치 기준 오름차순 정렬 후 `id`를 1부터 재부여
- `targetText`가 없는 노트는 맨 뒤로

### 적용 지점 (`src/pages/Index.tsx`)
1. **수동 추가 후** (`handleGenerateSyntax` - slotNumber 분기): 노트 추가 후 reorder 호출
2. **자동 생성 후** (auto 분기): 이미 순서대로 오지만 안전하게 reorder
3. **삭제 후** (`SyntaxNotesSection.onChange` → `handleDeleteNote`): 이미 id 재부여하고 있지만 위치 기반으로 변경

### 변경 파일
- `src/lib/syntax-superscript.tsx` — `reorderNotesByPosition` 함수 추가
- `src/pages/Index.tsx` — 수동 추가 후 reorder 적용
- `src/components/SyntaxNotesSection.tsx` — 삭제 시 reorder 적용 (원문 prop 필요하면 추가)

