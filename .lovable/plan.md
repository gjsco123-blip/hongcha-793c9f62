

# 홍T 저장 버그 수정

## 원인
`autoSave`(line 212)가 `generatingHongT === true`인 문장이 하나라도 있으면 저장을 건너뜀. `handleAnalyze`에서 홍T를 순차 생성하는 동안 해당 플래그가 계속 켜져 있어 저장이 차단됨. 생성 완료 후 `setLoading(false)` → autoSave 트리거되지만 2초 debounce 중 페이지 이탈 시 저장 누락.

## 수정 내용 (`src/pages/Index.tsx`)

### 1. handleAnalyze 끝에 강제 즉시 저장 추가
- `setHongTPhase(null)` 후, `setLoading(false)` 전에 즉시 DB 저장 호출
- debounce 없이 직접 `categories.updatePassage()` 호출
- `results` state 대신 최신 `newResults` (로컬 변수) 사용하여 stale closure 문제 회피
- transient 플래그 strip 후 저장

```typescript
// 홍T 생성 완료 후 즉시 저장
const latestResults = /* get latest results from state */;
const sanitized = latestResults.map(({ generatingSyntax, generatingHongT, regenerating, ...rest }) => rest);
const mergedStore = mergePassageStore(categories.selectedPassage?.results_json, {
  syntaxResults: sanitized,
  completion: { syntaxCompleted: true },
});
await categories.updatePassage(categories.selectedPassageId!, {
  passage_text: passage,
  pdf_title: pdfTitle,
  preset,
  results_json: mergedStore,
});
```

### 2. 최신 results 접근 문제 해결
- `handleAnalyze` 내에서 `generateHongT`가 `setResults`로 state를 업데이트하므로, 강제 저장 시점에 최신 results를 가져오기 위해 ref(`resultsRef`)를 활용하거나, `setResults`의 콜백에서 최신값을 캡처

이렇게 하면 홍T 생성 완료 즉시 DB에 저장되어 페이지 이탈 시에도 데이터가 유지됨.

