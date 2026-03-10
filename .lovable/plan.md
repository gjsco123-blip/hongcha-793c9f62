

# 구문분석 자동생성 — targetText 정확도 + 동일 대상 병합 규칙

## 문제 정리

사용자가 보고한 3가지 이슈:

1. **targetText 위치 오류**: to부정사 관련 설명에서 위첨자가 수식 대상("balance", "vote to")에 찍히는데, 문법 요소 자체("to maintain", "to restrict")에 찍혀야 함
2. **순서 오류**: 포인트들이 문장 등장 순서가 아닌 중요도 순으로 정렬됨
3. **동일 대상 병합**: 같은 단어/구문("to restrict")에 대한 설명이 2개면 하나의 번호로 묶고 줄을 나눠 표시해야 함 (예: 2번에 두 줄)

## 변경 내용

### 1. `supabase/functions/grammar/index.ts` — `buildAutoSystemPrompt` 프롬프트 수정

**순서 규칙 변경**:
- `"문장의 핵심 구문부터 우선순위로"` → `"문장에서 왼쪽부터 등장하는 순서대로 정렬하라"`

**targetText 규칙 보강**:
- "targetText는 해당 문법 요소 자체가 위치한 곳을 가리켜야 한다. 수식 대상(피수식어)이 아님."
- 구체적 예시 추가:
  - ✅ `to부정사 형용사적 용법 → targetText: "to maintain"` (to부정사 자체)
  - ❌ `targetText: "a hard balance"` (수식 대상은 안 됨)
  - ✅ `restrict A to B 구조 → targetText: "to restrict the"`
  - ✅ `지시대명사 that → targetText: "that is a"`

**동일 대상 병합 규칙 추가**:
- "같은 단어/구문에 대해 여러 포인트가 있으면 하나의 targetText를 공유하고 points 배열에서 연속 배치하라. 프론트엔드가 같은 targetText를 가진 연속 포인트를 하나의 번호로 묶어 표시한다."

### 2. `src/pages/Index.tsx` — 자동생성 결과 후처리

autoPoints를 받은 뒤, 같은 targetText를 가진 연속 포인트를 하나의 번호(id)로 병합:
- 예: `[{text: "A", targetText: "to restrict"}, {text: "B", targetText: "to restrict"}]` → 둘 다 `id: 3`, content를 줄바꿈으로 합침

### 3. `src/components/SyntaxNotesSection.tsx` — 병합된 노트 표시

content에 줄바꿈이 있으면 같은 번호 아래 여러 줄로 표시 (현재 `whitespace-pre-wrap`이 이미 적용되어 있으므로 별도 렌더링 변경 불필요)

### 4. `src/components/PdfDocument.tsx` — PDF에서도 병합 번호 처리

syntaxNotes 렌더링 시, 이전 note와 같은 id면 번호 라벨 없이 내용만 출력

변경 파일: 4개 (grammar/index.ts 프롬프트, Index.tsx 후처리, SyntaxNotesSection.tsx, PdfDocument.tsx)

