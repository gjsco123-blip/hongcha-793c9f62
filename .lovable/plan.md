# 재생성 다양화 (A안)

## 목표
주제/제목/요약 재생성을 누를 때마다 **다른 표현·각도**의 결과가 나오게 만든다. 첫 생성 톤·품질은 유지.

## 원인 (재확인)
1. `callAi`가 모든 호출에서 `temperature: 0.25` → 거의 결정론적
2. 재생성 요청 payload에 이전 답이 없음 → 모델 입장에서 첫 호출과 동일 입력
3. 결과: 같은 지문 = 같은 답 반복

## 변경 지점

### 1. `supabase/functions/analyze-preview/index.ts`

**(a) `callAi`에 옵션 인자 추가**
```ts
async function callAi(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  opts?: { temperature?: number },
) {
  // body의 temperature를 opts?.temperature ?? 0.25 로
}
```
→ 첫 생성(mode="all" 내부 4개 호출)은 기존 0.25 유지. 재생성만 0.85.

**(b) 요청 payload 확장**
```ts
const { passage, mode, grade, previous } = await req.json();
// previous?: { topic?: string; title?: string; one_sentence_summary?: string }
```

**(c) `runSingleMode` 시그니처 확장**
```ts
async function runSingleMode(
  mode: SingleMode,
  passage: string,
  grade: Grade,
  apiKey: string,
  opts?: { previous?: string; temperature?: number },
)
```
- `previous`가 있으면 system prompt 끝에 회피 지시 1블록 append:
  ```
  [재생성 지시]
  - 직전에 제시한 답: "<previous>"
  - 위 답과 **다른 각도/관점/명사 선택**으로 작성할 것.
  - 같은 핵심 명사·동일 표현의 단순 변형(어순만 바꾸기 등) 금지.
  - 단, [topic/title/exam_summary 규칙]과 [고N 톤]은 그대로 준수할 것.
  ```
- `temperature`는 `callAi(..., { temperature })`로 전달

**(d) 단일 모드 분기에서 previous/temperature 전달**
```ts
if (mode !== "all") {
  const previous =
    mode === "topic" ? body.previous?.topic
    : mode === "title" ? body.previous?.title
    : mode === "exam_summary" ? body.previous?.one_sentence_summary
    : undefined; // passage_summary는 스킵 (이번 변경 범위 밖)

  const temperature = previous ? 0.85 : undefined;
  const parsed = await runSingleMode(mode, passage, grade, KEY, { previous, temperature });
}
```
→ `previous`가 있을 때만 temperature 0.85. 없으면 기존 0.25 동작.
→ `mode="all"` 병렬 호출 경로는 손대지 않음 (첫 생성 톤 보존).

**(e) length-retry 호환**
- `passage_summary`의 length-retry는 영향 없음 (재생성 다양화 대상 아님)
- topic/title/exam_summary에는 length-retry가 없으므로 충돌 없음

### 2. `src/pages/Preview.tsx`

세 재생성 콜백에 현재 값을 `previous`로 실어 보냄:
```ts
const regenExamTopic = useCallback(async () => {
  const data = await invokeWithFallback(
    "analyze-preview",
    { passage, mode: "topic", grade, previous: { topic: examBlock?.topic } },
    { passage, grade },
  );
  ...
}, [passage, grade, examBlock?.topic]);

// title도 previous: { title: examBlock?.title }
// exam_summary도 previous: { one_sentence_summary: examBlock?.one_sentence_summary }
```
→ 의존성 배열에 현재 값 추가 (최신 값으로 회피하기 위해)
→ Fallback 호출({passage, grade})에는 previous 없음 — 의도적 (실패 시 재생성 시드라도 받기)

### 3. `.lovable/memory/architecture/analyze-preview-modes.md` 업데이트
- "재생성 다양화 정책" 섹션 추가:
  - topic/title/exam_summary 재생성 시 `previous` 동봉, temperature 0.85
  - passage_summary 재생성은 영향 없음 (length 강제 우선)
  - mode="all" 첫 생성은 temperature 0.25 유지

## 동작 흐름

```text
[첫 생성]  invoke({ passage, grade })
  → mode="all" → 4개 병렬 호출 (temp 0.25, previous 없음)  ← 변경 없음

[Topic 재생성] invoke({ passage, mode:"topic", grade, previous:{ topic:"현재값" } })
  → runSingleMode("topic", ..., { previous, temperature: 0.85 })
  → system prompt 끝에 [재생성 지시] 블록 append
  → 다른 각도/표현의 topic 반환

[Title / Exam Summary 재생성] 동일 패턴
```

## 영향 없는 영역
- DB / RLS / 스키마
- mode="all" 첫 생성 경로 (temperature, prompt 모두 그대로)
- passage_summary 재생성 (요약 영역)
- 다른 엣지 함수 / 프론트 컴포넌트

## 롤백
한 커밋 되돌리기로 복구. `previous`/`temperature`는 옵셔널이라 부분 롤백도 안전.
