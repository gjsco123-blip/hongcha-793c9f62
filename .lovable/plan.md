## 목표
지문 분석 시 LLM이 지문 자체를 보고 "이 정도 난이도네" 자동 판단하던 불안정한 방식을 제거하고, **학교명에서 학년(고1/고2/고3)을 추출해 명시적으로 LLM에 주입**한다. 적용 범위는 Preview의 **Topic / Title / Exam Summary** (Passage Summary, Vocab, Synonyms는 영향 없음).

## 변경 지점

### 1. `src/lib/grade-utils.ts` (신규)
학년 추출 유틸 한 곳에 모음.
```ts
export type Grade = 1 | 2 | 3;
export function extractGradeFromSchoolName(name?: string): Grade {
  const m = name?.match(/고\s*([1-3])/);
  return (m ? Number(m[1]) : 2) as Grade; // 폴백: 고2
}
```

### 2. `src/pages/Index.tsx`
Preview로 navigate할 때 학교명에서 학년 추출 후 state에 실어 전달.
- 선택된 school 객체 찾기 → `extractGradeFromSchoolName(school.name)` → state에 `grade` 추가
- 위치: line 978 navigate 호출

### 3. `src/pages/Preview.tsx`
- `location.state?.grade`로 수신, sessionStorage 백업 저장 (새로고침 대비)
- `handleGenerate`의 `analyze-preview` 호출 body에 `grade` 추가
- `regenExamTopic` / `regenExamTitle` / `regenExamSummary` 호출 body에 `grade` 추가
- (`regenSummary`는 손대지 않음 — passage_summary는 학년 영향 없는 영역)

### 4. `supabase/functions/analyze-preview/index.ts`
- 요청 body Zod 스키마에 `grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()` 추가, 폴백 2
- 모든 시스템 프롬프트 맨 앞에 학년 한 줄 prepend:
  ```
  Target audience: 한국 고등학교 ${grade}학년 (고${grade}).
  Calibrate vocabulary range, sentence complexity, and abstraction level accordingly.
  고1: 기초 어휘/단순 구조. 고2: 중급. 고3: 수능 수준 추상 어휘/복잡 구조.
  ```
- 적용 위치:
  - `mode:"all"`: 기존 `SYSTEM_PROMPT` 앞에 prepend (본문 215줄은 그대로)
  - `mode` 모듈 조립: `buildSystemPrompt(mode, grade)` 시그니처로 변경, 결과 앞에 prepend
- `PROMPT_INTRO`의 "Internally analyze Difficulty..." 문장은 그대로 둠 (학년 + 자체 판단 보완 효과)

### 5. `.lovable/memory/architecture/analyze-preview-modes.md` (업데이트)
- "SYSTEM_PROMPT 절대 건드리지 말 것" 규칙에 **예외 추가**: 학년 주입은 본문 변경 아니라 prepend 한 줄이므로 허용
- mode 호출 시 `grade` 파라미터가 표준임을 명시

## 동작 시나리오

```text
[학교 생성] "시온고1" → DB에 그대로 저장 (스키마 변경 없음)
       │
       ▼
[Index에서 Preview 진입]
   school.name "시온고1" → extractGrade() → 1
   navigate("/preview", { state: { ..., grade: 1 } })
       │
       ▼
[Preview 첫 생성]
   invoke("analyze-preview", { passage, grade: 1 })
       │
       ▼
[Edge Function]
   SYSTEM_PROMPT 앞에 "Target audience: 고1..." prepend → LLM 호출
       │
       ▼
[재생성 (Topic만)]
   invoke("analyze-preview", { passage, mode: "topic", grade: 1 })
       → buildSystemPrompt("topic", 1) → 동일 프리픽스 + 모듈 → LLM
```

## 영향 없는 영역
- DB 스키마 (schools 테이블 변경 없음)
- analyze-vocab, analyze-synonyms (학년 무관)
- passage_summary 모드 (사용자 명시 요청)
- syntax / hongt 파이프라인 전체

## 폴백 / 안전장치
- 학교명에 "고N" 없음 → 고2
- Index에서 직접 입력(학교 미지정) 진입 케이스 → grade 없으면 백엔드에서 고2 폴백
- 기존 cache(grade 없는 sessionStorage) 호환 → undefined → 고2 폴백
