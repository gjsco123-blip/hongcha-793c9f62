

# 구문분석 수동 모드 1개 제한 + AI 수정 번호 선택 UI

## 변경 내용

### 1. 수동(드래그) 구문분석: 설명 1개만 출력

**`supabase/functions/grammar/index.ts`** — 힌트 모드(비auto)에서:
- `buildHintSystemPrompt()`의 `points는 1~3개(최대 3)` → `points는 반드시 1개만`으로 변경
- 하단 `maxPts` 계산(line 525): `useFreestyle ? 5 : 3` → `useFreestyle ? 5 : 1`로 변경
- 이렇게 하면 드래그 선택 시 항상 설명 1개만 반환됨

### 2. AI 수정: 번호 클릭으로 개별 수정

현재 AI 수정은 전체 구문분석을 대상으로 채팅하는 구조. 이를 **특정 번호를 선택하여 해당 포인트만 수정**하는 UX로 변경.

**`src/components/SyntaxNotesSection.tsx`**:
- AI 수정 버튼 클릭 시 바로 Sheet를 열지 않고, 각 note 옆에 클릭 가능한 상태로 전환 (또는 note 목록에서 번호를 클릭하면 해당 번호의 note만 대상으로 SyntaxChat을 열기)
- `selectedNoteIndex` state 추가
- 번호(1. 2. 3.)를 클릭하면 해당 note를 `selectedNote`로 설정하고 SyntaxChat을 열기

**`src/components/SyntaxChat.tsx`**:
- 새 prop: `targetNoteIndex?: number` (수정 대상 번호)
- 헤더에 "N번 구문분석 수정" 표시
- `currentNotes` 대신 해당 번호의 note 1개만 컨텍스트로 표시
- `onApplySuggestion`도 해당 번호의 note만 교체하도록 변경

**`supabase/functions/grammar-chat/index.ts`**:
- `targetNoteIndex`를 받아서 컨텍스트에 "수정 대상: N번 포인트"를 명시
- 수정안도 해당 포인트 1개만 반환하도록 프롬프트 조정

변경 파일 4개: `grammar/index.ts`, `grammar-chat/index.ts`, `SyntaxNotesSection.tsx`, `SyntaxChat.tsx`

