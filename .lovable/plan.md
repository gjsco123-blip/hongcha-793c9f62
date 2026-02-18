

## 메인 분석(engine) 속도 개선 - 병렬 처리

### 현재 문제
- 문장들을 `for` 루프로 **순차 처리** (1번 끝나야 2번 시작)
- `gemini-2.5-pro`는 문장당 약 10~15초 소요
- 10문장이면 100~150초 대기

### 해결 방법: 병렬 호출
모델을 바꾸지 않고, 여러 문장을 **동시에** AI에 요청하면 총 대기 시간이 크게 줄어듭니다.

예를 들어 10문장을 3개씩 동시 호출하면:
- 현재: 10 x 12초 = ~120초
- 변경 후: 4라운드 x 12초 = ~48초 (약 60% 단축)

### 수정 내용

**파일: `src/pages/Index.tsx` - `handleAnalyze` 함수**

현재 순차 `for` 루프를 **동시 3개씩 병렬 처리**로 변경:

```text
현재: for (i = 0; i < sentences.length; i++) { await invoke("engine", ...) }

변경: 3개씩 묶어서 Promise.allSettled로 동시 호출
      -> 완료되는 대로 결과를 화면에 표시
      -> 실패한 문장은 개별 에러 처리
```

- 동시 호출 수(concurrency)를 3으로 제한하여 서버 과부하 방지
- 각 배치 완료 시 즉시 `setResults`로 화면 업데이트
- 진행률 표시도 배치 단위로 업데이트

### 기술 세부사항

```typescript
// 변경 전: 순차 처리
for (let i = 0; i < sentences.length; i++) {
  const { data } = await supabase.functions.invoke("engine", { body: { sentence: sentences[i], preset } });
  // ... 결과 추가
}

// 변경 후: 3개씩 병렬 처리
const CONCURRENCY = 3;
for (let batch = 0; batch < sentences.length; batch += CONCURRENCY) {
  const chunk = sentences.slice(batch, batch + CONCURRENCY);
  const promises = chunk.map((s, j) =>
    supabase.functions.invoke("engine", { body: { sentence: s, preset } })
      .then(({ data, error }) => ({ idx: batch + j, data, error }))
  );
  const results = await Promise.allSettled(promises);
  // 각 결과를 newResults에 추가하고 setResults 업데이트
}
```

### 기대 효과
- 모델 변경 없이 총 소요 시간 약 50~60% 단축
- 퀄리티는 동일 (같은 모델, 같은 프롬프트)
- 결과가 배치 단위로 점진적으로 화면에 표시됨

### 수정 파일
- `src/pages/Index.tsx` (`handleAnalyze` 함수의 순차 루프를 병렬 배치로 변경)
