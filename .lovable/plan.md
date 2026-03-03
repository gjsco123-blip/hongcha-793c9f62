

## 준동사 원형 변환 예외 규칙 추가

### 변경 내용

`analyze-vocab/index.ts` line 116의 기존 원형 변환 규칙에 예외 조건을 추가합니다.

**현재** (line 116):
```
- 과거분사/현재분사가 동사에서 파생된 경우 가능한 한 원형 동사로 표기하라 (abandoned → abandon, permitting → permit).
```

**변경 후**:
```
- 과거분사/현재분사가 동사에서 파생된 경우 가능한 한 원형 동사로 표기하라 (abandoned → abandon, permitting → permit).
  단, 다음은 원형으로 변환하지 않는다:
  · 전치사적 용법의 분사: concerning, regarding, considering, given, including, following 등
  · 고정 표현 속 분사: based (be based on), involved (be involved in), related (be related to) 등
```

**`analyze-single-vocab/index.ts`** line 38~43 규칙에도 동일 예외 추가:
```
- word는 원형 동사로 표기하되, 전치사적 용법(concerning, regarding 등)이나
  고정 표현(be based on, be involved in 등)의 분사는 그대로 유지
```

### 변경 파일
- `supabase/functions/analyze-vocab/index.ts` — line 116 수정
- `supabase/functions/analyze-single-vocab/index.ts` — 규칙 추가

