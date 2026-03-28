

# 강제 저장 시 최신 results 보장 — 근본 수정

## 핵심 문제
`prevResultsRef`는 `useEffect`로 동기화되므로 **다음 렌더 사이클**에서만 업데이트됨. `handleAnalyze`의 async 루프 안에서 `generateHongT` → `setResults` 호출 후 즉시 `prevResultsRef.current`를 읽으면 **이전 값**이 반환됨. 결과적으로 빈 데이터 또는 홍T 없는 데이터가 DB에 저장됨.

## 해결 방법: `setResults` 래퍼로 ref 즉시 동기화

### `src/pages/Index.tsx` 수정

**1. `setResults` 래퍼 함수 생성**
- `setResults` 호출 시마다 `resultsRef`도 즉시(동기적으로) 업데이트
- 기존 `prevResultsRef` + `useEffect` 동기화 로직 제거

```typescript
const resultsRef = useRef<SentenceResult[]>([]);
const updateResults = useCallback((updater: SetStateAction<SentenceResult[]>) => {
  setResults((prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    resultsRef.current = next;
    return next;
  });
}, []);
```

**2. 모든 `setResults` 호출을 `updateResults`로 교체**
- `handleAnalyze`, `generateHongT`, `handleChunkChange`, `handleGenerateSyntax`, `handleReanalyze` 등 모든 곳

**3. 강제 저장 로직에서 `resultsRef.current` 사용**
- line 386의 `prevResultsRef.current` → `resultsRef.current`
- ref가 항상 최신이므로 홍T 포함 전체 데이터가 저장됨

**4. 정리**
- `prevResultsRef` + `useEffect` (line 204-207) 제거 (learning_examples 저장용으로만 사용되었으나, 새 `resultsRef`로 대체)
- `saveSyntaxLearningExamples` 호출도 `resultsRef.current` 사용

이 방식이면 `setResults`가 호출되는 모든 곳에서 ref가 즉시 동기화되므로, 강제 저장 시점에 항상 최신 데이터를 읽을 수 있음.

