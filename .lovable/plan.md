

# 동반의어 칩도 원형화 적용

## 문제
- `take on (띠다)` — word는 `takes on` → `take on`으로 정규화됨 ✅
- 하지만 동의어 `assumes`, `acquires`, 반의어 `loses`, `sheds` 등은 그대로 유지됨 ❌
- 원인: `normalizeChipField()`가 `normalizeEnglish()`만 호출 (소문자/공백 정리만 수행), 원형화 없음

## 수정 내용

### `src/lib/synonym-sanitizer.ts`

1. **`normalizeChipField`에 품사 컨텍스트 전달**: word의 한국어 뜻이 `~다`로 끝나면 동사 → 칩도 `normalizeVerbPhraseHead` 적용, 아니면 `toSingularOnly`만 적용

```typescript
// 변경 전
const normalizeChipField = (raw: string) => {
  // ... normalizeEnglish(en) 만 호출
};

// 변경 후
const normalizeChipField = (raw: string, wordKo: string) => {
  // 각 chip에 대해:
  // wordKo가 "~다"로 끝나면 → normalizeVerbPhraseHead(en, chipKo)
  // 아니면 → toSingularOnly(en) (기존 비동사 로직)
};
```

2. **`sanitizeSynonymItems` 내 호출부 수정**: word의 ko를 `normalizeChipField`에 전달

### `src/lib/synonym-sanitizer.test.ts`
- 테스트 추가: `takes on (띠다)` + synonyms `assumes (띠다), acquires (얻다)` → `assume, acquire`로 원형화 확인

## 수동 추가 경로
- 수동 추가 시에도 `onSynonymsChange` → `sanitizeSynonymItems(next, passage)` 경로를 탐 (line 430)
- 따라서 동일한 정규화가 자동 적용됨 ✅

