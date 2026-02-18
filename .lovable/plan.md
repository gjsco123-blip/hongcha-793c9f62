
## 구문분석 번호 시스템 추가

### 개요
구문분석 항목에 번호(1~5)를 부여하고, 드래그 시 힌트 팝업에서 몇 번 설명인지 선택할 수 있도록 함.

### 변경 내용

**1. `SentenceResult` 데이터 구조 변경 (`src/pages/Index.tsx`)**
- `syntaxNotes: string` → `syntaxNotes: SyntaxNote[]` 형태로 변경
- `SyntaxNote = { id: number; content: string }` (id는 1~5)
- 기존 문자열 기반 구문분석 데이터를 배열 기반으로 전환

**2. 힌트 팝업에 번호 선택 추가 (`src/components/ChunkEditor.tsx`)**
- 힌트 입력 팝업 상단에 번호 버튼(1~5) 표시
- 이미 사용된 번호는 비활성화 또는 표시
- 선택한 번호가 `onAnalyzeSelection(selectedText, userHint, slotNumber)`로 전달됨

**3. `onAnalyzeSelection` 콜백 시그니처 변경**
- `(text: string, hint?: string)` → `(text: string, hint?: string, slotNumber?: number)` 
- `handleGenerateSyntax`도 `slotNumber` 파라미터 추가
- 응답을 받으면 해당 번호 슬롯에 결과를 저장 (기존 내용 덮어쓰기)

**4. `SyntaxNotesSection` 번호별 표시 (`src/components/SyntaxNotesSection.tsx`)**
- 배열 기반으로 변경: 각 항목 앞에 번호 표시 (예: `①`, `②`)
- 개별 항목 삭제 가능
- 수정 모드에서는 각 항목별로 편집

**5. 자동 생성 버튼 동작 변경**
- "자동 생성" 클릭 시 기존처럼 전체 문장을 분석하되, 결과를 번호 1부터 순차적으로 채움

### UI 흐름

```text
[텍스트 드래그] → [선택 구문분석 클릭]
                       ↓
            ┌──────────────────────────┐
            │  번호: [1] [2] [3] [4] [5]  │
            │  선택: "which were..."       │
            │  [힌트 입력란]              │
            │  [정리하기]  [자동생성]      │
            └──────────────────────────┘
                       ↓
            구문분석 섹션에 해당 번호로 표시:
            ① 주격 관계대명사 which가...
            ② (아직 없음)
            ③ 전치사 by 뒤에 동명사가...
```

### 수정 파일
- `src/pages/Index.tsx` (데이터 구조 + 핸들러)
- `src/components/ChunkEditor.tsx` (번호 선택 UI)
- `src/components/SyntaxNotesSection.tsx` (번호별 표시)
- `src/components/PdfDocument.tsx` (PDF 출력 호환 — 배열을 문자열로 변환)
