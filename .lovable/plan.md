# analyze-preview 리팩토링 — 프롬프트 모듈화 + mode 분기

## 목표
- **편집 격리**: topic / title / exam_summary / passage_summary 4개 영역의 프롬프트 규칙을 코드 레벨에서 분리하여, 한 영역 수정이 다른 영역에 영향 주지 않게 함.
- **실행 격리**: 재생성 버튼이 진짜로 자기 필드만 LLM에 요청하게 함 (현재는 매번 4개 전부 생성 후 한 필드만 채택).
- **비용 절감**: 재생성 시 LLM 호출 1회로 (현재는 최대 3회 — 본 호출 + self-critique + length-retry).
- **첫 생성 동작 보존**: `mode: "all"`은 기존 SYSTEM_PROMPT를 그대로 사용해 회귀 위험 0.

---

## 변경 범위

### 1. `supabase/functions/analyze-preview/index.ts` (재구성)

#### A. 프롬프트 모듈화
기존 215줄짜리 SYSTEM_PROMPT를 다음 상수로 분리:

```
PROMPT_INTRO              — 역할/공통 지시 (Step 1~3 난이도/내부 분석)
PROMPT_TOPIC_RULES        — topic + topic_ko 규칙 + Sample Correct Answers 12개
PROMPT_TITLE_RULES        — title + title_ko 규칙
PROMPT_EXAM_SUMMARY_RULES — one_sentence_summary + 직역 규칙 + 직역 예시
PROMPT_PASSAGE_SUMMARY_RULES — ①②③④ 규칙 + 길이 강제(45~58자) + 종결 스타일 + Few-shot
PROMPT_COMMON_RULES       — Critical Korean Exam Rules (4개 영역 공통)
PROMPT_OUTPUT_ALL         — 전체 모드 JSON 출력 형식
PROMPT_OUTPUT_<MODE>      — 모드별 단일 필드 JSON 출력 형식
```

#### B. `SYSTEM_PROMPT_ALL` (기존 동작 보존)
기존 SYSTEM_PROMPT 문자열을 **그대로** 보존하여 `mode: "all"` 또는 mode 미지정 시 사용. 토큰 순서 보존 → 첫 생성 결과 동일성 보장.

#### C. mode별 SYSTEM_PROMPT 합성 함수
```ts
function buildSystemPrompt(mode: Mode): string {
  switch (mode) {
    case "topic":           return [PROMPT_INTRO, PROMPT_TOPIC_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_TOPIC].join("\n\n");
    case "title":           return [PROMPT_INTRO, PROMPT_TITLE_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_TITLE].join("\n\n");
    case "exam_summary":    return [PROMPT_INTRO, PROMPT_EXAM_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_EXAM_SUMMARY].join("\n\n");
    case "passage_summary": return [PROMPT_INTRO, PROMPT_PASSAGE_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_PASSAGE_SUMMARY].join("\n\n");
    case "all":
    default:                return SYSTEM_PROMPT_ALL;  // 기존 그대로
  }
}
```

#### D. mode별 출력 JSON 형식
| mode | 출력 JSON |
|---|---|
| `all` (기본) | 기존 동일: `{ summary, exam_block: { topic, topic_ko, title, title_ko, one_sentence_summary, one_sentence_summary_ko } }` |
| `topic` | `{ exam_block: { topic, topic_ko } }` |
| `title` | `{ exam_block: { title, title_ko } }` |
| `exam_summary` | `{ exam_block: { one_sentence_summary, one_sentence_summary_ko } }` |
| `passage_summary` | `{ summary }` |

#### E. self-critique / length-retry 분기
- `mode: "all"` — 기존대로 self-critique 1회 + length-retry 1회.
- `mode: "passage_summary"` — length-retry만 적용 (45~58자 검증). self-critique 생략(불필요한 비용).
- `mode: "topic" | "title" | "exam_summary"` — 둘 다 생략 (단일 필드라 critique 불필요).

#### F. 입력 스키마
```ts
const { passage, mode = "all" } = await req.json();
const VALID_MODES = ["all", "topic", "title", "exam_summary", "passage_summary"];
if (!VALID_MODES.includes(mode)) → 400 + 메시지
```

#### G. 로깅
```
console.log(`[analyze-preview] mode=${mode}`);
```

---

### 2. `src/pages/Preview.tsx` (4줄 수정 + fallback)

#### 변경 라인
```ts
// 322줄 부근
const regenExamTopic = useCallback(async () => {
  const data = await invokeWithFallback("analyze-preview", { passage, mode: "topic" }, { passage });
  ...
});

const regenExamTitle = useCallback(async () => {
  const data = await invokeWithFallback("analyze-preview", { passage, mode: "title" }, { passage });
  ...
});

const regenExamSummary = useCallback(async () => {
  const data = await invokeWithFallback("analyze-preview", { passage, mode: "exam_summary" }, { passage });
  ...
});

const regenSummary = useCallback(async () => {
  const data = await invokeWithFallback("analyze-preview", { passage, mode: "passage_summary" }, { passage });
  ...
});
```

#### Fallback 헬퍼 추가
```ts
async function invokeWithFallback(fn: string, primaryBody: any, fallbackBody: any) {
  try {
    return await invokeRetry(fn, primaryBody);
  } catch (e) {
    console.warn(`[Preview] mode call failed, falling back:`, e);
    return await invokeRetry(fn, fallbackBody);  // mode 없이 재호출
  }
}
```
mode 호출이 실패하거나 응답이 비어있으면 자동으로 mode 미지정으로 재호출 → 안전망.

#### 첫 생성 (`handleGenerate`) — **변경 없음**
이미 `{ passage }` 만 보내므로 백엔드에서 `mode = "all"` 기본값 적용. 기존 동작 100% 보존.

---

## 안전장치 4종 (확인)

1. ✅ **`mode: "all"` 기존 SYSTEM_PROMPT 그대로** — 첫 생성 결과 동일성 보장
2. ✅ **mode별 프롬프트는 재생성 전용** — 첫 생성 품질 영향 0
3. ✅ **프론트 fallback** — mode 호출 실패 시 자동 mode 미지정 재호출
4. ✅ **콘솔 로그** — 어느 mode 호출됐는지 추적 가능

---

## 검증 계획 (구현 직후)

1. 첫 생성 (`mode: "all"`): 기존 결과와 4개 필드 모두 비슷한 톤·길이로 나오는지 확인 (이전 출력과 비교).
2. `mode: "topic"`: topic, topic_ko 두 개만 반환되는지, 톤이 Sample Correct Answers와 일치하는지.
3. `mode: "title"`: 5~9 단어 명사구로 나오는지.
4. `mode: "exam_summary"`: 정확히 한 문장 + 직역 한글이 영문 어순 보존하는지.
5. `mode: "passage_summary"`: ①②③④ 4줄, 각 줄 45~58자, 명사형 종결인지. length-retry 정상 동작 확인.
6. Fallback: mode 파라미터 일부러 잘못 보내서 400 → 프론트 fallback 발동 → 정상 응답 받는지 (콘솔 로그로 확인).

---

## 작업량 추정
- 엣지 함수: 재구성 ≈ 280줄 (현재 424줄 → 약간 줄거나 유지)
- 프론트: ≈ 10줄 (헬퍼 + 4개 콜 사이트)
- 예상 시간: 1시간 ~ 1시간 30분

---

## 한계 (솔직)
- mode별 프롬프트 단독 실행 시 품질은 **실측 전엔 100% 보장 불가**. 첫 생성 결과는 보존되지만, 단독 모드 결과가 아주 약간 다른 톤으로 나올 수 있음 → 그 경우 해당 mode 프롬프트만 손보면 됨 (이게 바로 너가 원했던 격리).
- self-critique 생략한 모드(topic/title/exam_summary)는 한 번에 좋은 결과를 못 낼 가능성이 약간 있음. 필요하면 나중에 mode별 mini-critique 추가 가능.
