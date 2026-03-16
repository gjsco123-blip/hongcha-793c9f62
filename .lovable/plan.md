

# 동반의어 추가 개선: 한국어 뜻 + 숙어/이어동사 지원

## 문제 2가지

1. **Word에 한국어 뜻 미표시**: `enrich-synonym` 함수가 동/반의어만 반환하고 word 자체의 한국어 뜻을 반환하지 않음
2. **숙어/이어동사 선택 불가**: 지문에서 단어를 개별 클릭하는 방식이라 `turn down`, `take up` 같은 다단어 표현을 선택할 수 없음

## 해결 방안

### 1. `enrich-synonym` 함수 수정
- 프롬프트에 `word_ko` (단어의 한국어 뜻) 필드를 추가 요청
- 응답 JSON: `{"word_ko": "제안하다", "synonyms": "...", "antonyms": "..."}`
- 프론트에서 word를 `suggest (제안하다)` 형태로 표시

### 2. 숙어 선택: 다중 단어 선택 모드
- 동반의어 선택 모드에서 단어를 클릭하면 즉시 API 호출 대신 **선택 버퍼에 누적**
- 클릭한 단어들이 하이라이트되고, "추가" 확인 버튼이 나타남
- 확인 클릭 시 선택된 단어들을 공백으로 합쳐 `enrich-synonym` 호출 (예: `turn down`)
- 단일 단어만 선택하고 확인해도 동작
- 선택 초기화(X) 버튼도 제공

### 변경 파일

**`supabase/functions/enrich-synonym/index.ts`**
- 프롬프트에 `word_ko` 필드 추가
- 응답에서 `word_ko` 파싱 후 반환

**`src/components/preview/PreviewPassageInput.tsx`**
- 동반의어 모드일 때: 클릭 시 단어를 `selectedWords` 배열에 토글
- 선택된 단어들 하이라이트 + 하단에 "turn down → 추가" 확인 UI
- 확인 시 `onSynonymWordClick(selectedWords.join(" "))` 호출

**`src/pages/Preview.tsx`**
- `handleSynonymWordClick`에서 받은 word(단일 또는 다단어)를 그대로 `enrich-synonym`에 전달
- 응답의 `word_ko`를 사용해 `word: "turn down (거절하다)"` 형태로 저장

**`src/components/preview/types.ts`**
- `SynAntItem` 변경 불필요 — word 필드에 `"turn down (거절하다)"` 형태로 저장

