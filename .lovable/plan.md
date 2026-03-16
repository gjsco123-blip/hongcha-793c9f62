

# 동반의어 행 삭제 + 지문에서 단어 추가 기능

## 변경 파일 3개

### 1. `PreviewPassageInput.tsx` — 선택 모드 확장
- 현재: `onWordClick` 하나로 어휘 추가만 지원
- 변경: 새 prop `selectTarget: "vocab" | "synonym"` 추가, 외부에서 모드 제어
- `onSynonymWordClick: (word: string) => void` prop 추가
- 선택 모드일 때 `selectTarget`에 따라 적절한 핸들러 호출
- 안내 문구도 target에 따라 변경 ("어휘에 추가" vs "동반의어에 추가")
- 모드 전환은 외부에서 제어 (동반의어 섹션의 "지문에서 추가" 버튼이 트리거)

### 2. `PreviewSynonymsSection.tsx` — 행 삭제 + "지문에서 추가" 버튼
- 각 행에 X 버튼 추가 (hover 시 표시) → 클릭 시 해당 행 제거
- 테이블 상단에 "지문에서 추가" 버튼 추가 → 클릭 시 부모에 콜백
- Props 추가: `onDeleteRow`, `onRequestAddFromPassage`

### 3. `Preview.tsx` — 상태 관리 + 새 단어 동반의어 생성
- `synonymSelectMode: boolean` 상태 추가
- 동반의어 섹션의 "지문에서 추가" 클릭 → `synonymSelectMode = true` → PassageInput을 선택 모드로 전환 + 스크롤 이동
- 지문에서 단어 클릭 시 `analyze-synonyms` 함수를 단일 단어용으로 호출 (word + passage)
- 이미 존재하는 단어면 toast로 안내
- 결과를 synonyms 배열에 추가
- 행 삭제 핸들러: `setSynonyms(prev => prev.filter(...))`

### 흐름
```text
동반의어 섹션 [지문에서 추가] 클릭
  → 지문 영역이 선택 모드로 전환 (스크롤 이동)
  → 단어 클릭
  → AI가 해당 단어의 동/반의어 생성
  → 테이블에 새 행 추가
  → 완료 또는 계속 추가
```

### 단일 단어 동반의어 생성
기존 `enrich-synonym` 함수를 활용하되, 새 단어는 빈 상태에서 시작하므로 `existingSynonyms: ""`, `existingAntonyms: ""`로 호출. 결과를 새 SynAntItem으로 추가.

