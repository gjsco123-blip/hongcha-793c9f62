## 문제
`src/pages/Preview.tsx`의 `loadSaved` 함수 내에서 `savedExam`을 계산할 때 아직 선언되지 않은 `savedPassage`를 참조하고 있어 TDZ(ReferenceError) 발생.

```ts
const savedExam = store.preview.examBlock ? normalizeExamBlock(..., savedPassage) : null;
const savedPassage = typeof store.preview.passage === "string" ... // ← 아래에 선언
```

## 수정 (1곳)
`src/pages/Preview.tsx`의 `loadSaved` 블록에서 **`savedPassage`를 먼저 선언**한 뒤 `savedExam`을 계산하도록 순서를 바꿉니다.

```ts
const savedVocab = Array.isArray(store.preview.vocab) ? (store.preview.vocab as VocabItem[]) : [];
const savedSynonyms = Array.isArray(store.preview.synonyms) ? (store.preview.synonyms as SynAntItem[]) : [];
const savedSummary = typeof store.preview.summary === "string" ? store.preview.summary : "";
const savedPassage = typeof store.preview.passage === "string" && store.preview.passage
  ? store.preview.passage
  : (typeof data.passage_text === "string" ? data.passage_text : "");
const savedExam = store.preview.examBlock ? normalizeExamBlock(store.preview.examBlock as ExamBlock, savedPassage) : null;
```

다른 로직/동작은 변경 없음. 빌드 후 Preview 진입 시 ReferenceError가 사라지는지 확인합니다.