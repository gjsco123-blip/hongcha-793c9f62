

# 부정 축약형(isn't, don't 등) 통째로 동사 태깅

## 문제

현재 엔진 프롬프트에 `'s`, `'re`, `'ve` 등 일반 축약형 규칙은 있지만, **부정 축약형(n't)** 규칙이 없음. AI가 `isn't`를 `is` + `n't`로 분리하거나, `is`만 동사 태깅하고 `n't`는 빠뜨리는 경우 발생.

## 수정 내용

### 1. 엔진 프롬프트 — 1차 분석 (`supabase/functions/engine/index.ts`)

`systemPrompt`의 VERB TAGGING 섹션(Contracted verbs 부분, ~140행)에 부정 축약형 규칙 추가:

```
- **Negative contractions**: isn't, don't, won't, can't, doesn't, hasn't, hadn't, wouldn't, couldn't, shouldn't, aren't, weren't, wasn't, mustn't — these are SINGLE verb units. Tag the ENTIRE word as one <v> block.
  - CORRECT: it <v>isn't</v> easy
  - WRONG: it <v>is</v>n't easy
  - CORRECT: they <v>don't</v> know
  - WRONG: they <v>do</v>n't know
```

### 2. 동사 검증 프롬프트 — 2차 검증 (`supabase/functions/engine/index.ts`)

`verbVerifyPrompt`(~410행)의 Contracted verbs 섹션에도 동일한 규칙 추가.

### 수정 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/engine/index.ts` | 프롬프트 2곳에 부정 축약형 규칙 추가 |

엔진 함수 재배포 필요. 클라이언트 코드 변경 없음.

