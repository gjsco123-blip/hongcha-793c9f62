

## 429/503 재시도 백오프 + 실패만 재시도 기능 추가

### 1. 지수 백오프 재시도 (engine 호출 래퍼)

각 문장의 engine 호출에 재시도 로직을 감싸는 헬퍼 함수를 추가합니다.

- 429 또는 503 에러 시 자동 재시도 (최대 3회)
- 대기 시간: 500ms -> 1000ms -> 2000ms (지수 백오프 + 랜덤 jitter)
- 400, 401, 402 등 영구적 에러는 즉시 실패 처리
- `Retry-After` 헤더가 있으면 해당 값 우선 사용

```typescript
async function invokeWithRetry(sentence: string, preset: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke("engine", {
      body: { sentence, preset },
    });

    // 성공
    if (!error && data && !data.error) return { data, error: null };

    // 429/503이면 백오프 후 재시도
    const status = error?.status || data?.error?.includes("Rate limit") ? 429 : 0;
    if ((status === 429 || status === 503) && attempt < maxRetries - 1) {
      const waitMs = Math.pow(2, attempt) * 500 + Math.random() * 500;
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    // 영구적 에러 또는 재시도 소진
    return { data, error };
  }
  return { data: null, error: new Error("Max retries exceeded") };
}
```

### 2. 중복 호출 방지

`handleAnalyze` 실행 중 버튼 재클릭 방지:
- 현재 `loading` 상태로 버튼은 비활성화되어 있지만, `handleRetryFailed`에도 동일한 guard 적용
- 진행 중인 문장 ID를 Set으로 관리하여 같은 문장 중복 호출 차단

### 3. "실패만 재시도" 버튼

분석 완료 후 실패한 문장이 있으면 "실패한 문장만 재시도" 버튼을 표시합니다.

```text
[분석 결과 영역]
  문장 1: 정상 결과 (캐시 유지)
  문장 2: "분석 실패" ← 이것만 재시도
  문장 3: 정상 결과 (캐시 유지)

  [실패한 2건 재시도] 버튼
```

동작:
- 성공한 결과는 그대로 유지 (`results` 배열에서 `koreanNatural !== "분석 실패"`인 항목 보존)
- 실패한 문장만 필터링하여 `invokeWithRetry`로 다시 호출
- 성공하면 해당 인덱스의 결과를 업데이트

### 수정 파일

- `src/pages/Index.tsx`
  - `invokeWithRetry` 헬퍼 함수 추가
  - `handleAnalyze`에서 `supabase.functions.invoke` 대신 `invokeWithRetry` 사용
  - `handleRetryFailed` 함수 추가 (실패 문장만 재분석)
  - 실패 문장이 있을 때 "실패만 재시도" 버튼 UI 추가

