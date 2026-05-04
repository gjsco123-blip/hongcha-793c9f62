---
name: analyze-preview mode 분기 구조
description: analyze-preview 엣지 함수의 mode별 프롬프트 모듈 위치와 호출 매핑
type: feature
---
`supabase/functions/analyze-preview/index.ts`는 mode 파라미터로 5가지 모드 지원: `all` | `topic` | `title` | `exam_summary` | `passage_summary`.

**핵심 정책 (A안)**: `mode="all"`은 더 이상 거대 SYSTEM_PROMPT 1회 호출이 아님. 4개 단일 모드(topic/title/exam_summary/passage_summary)를 **병렬 호출 + 머지**로 처리. 첫 생성과 재생성이 100% 동일한 프롬프트를 사용 → 톤·품질 일관성 확보.

**grade 파라미터 (필수 권장)**: `1 | 2 | 3` — 학교명에서 추출 (`extractGradeFromSchoolName`). 미지정 시 백엔드 폴백 = 2.
모든 모드에서 시스템 프롬프트 맨 앞에 `gradePrefix(grade)` 한 블록을 prepend → 학년별 톤·난이도 명시 주입.
학년 통합: 고1+고2 = 동일 prefix("고1~고2 대상"), 고3 = 별도 prefix("수능 수준").

**mode="all" (첫 생성)**: `Promise.allSettled`로 4개 단일 모드 병렬 호출 → `{ summary, exam_block }`로 머지하여 단일 응답 반환. stagger 50ms 간격으로 발사하여 rate-limit 압박 완화. 부분 실패 허용(1개 영역 실패해도 나머지 3개는 표시). SYSTEM_PROMPT / SELF_CRITIQUE_PROMPT 상수는 제거됨.

**모듈 프롬프트 (재생성 전용)**:
- `PROMPT_INTRO` — 공통 도입 (난이도/내부 분석)
- `PROMPT_TOPIC_RULES` — topic + topic_ko + Sample Correct Answers 12개
- `PROMPT_TITLE_RULES` — title + title_ko
- `PROMPT_EXAM_SUMMARY_RULES` — one_sentence_summary + 직역 규칙
- `PROMPT_PASSAGE_SUMMARY_RULES` — ①②③④ + 길이 강제(45~58) + Few-shot
- `PROMPT_COMMON_RULES` — Critical Korean Exam Rules
- `PROMPT_OUTPUT_<MODE>` — 모드별 JSON 출력 형식

**합성**: `buildSystemPrompt(mode, grade)` — `[INTRO, (topic만: topicExamplesByGrade), <MODE>_RULES, COMMON, OUTPUT_<MODE>].join("\n\n")`. topic 모드는 학년별 평가원 모범 답안 예시(`topicExamplesByGrade(grade)`)를 끼워넣음 — 첫 생성 톤 유지의 핵심.

**self-critique/length-retry (A안 정책)**:
- self-critique 패스는 **모든 모드에서 제거**됨 (비용·속도 우선).
- length-retry는 `passage_summary` 모드 내부에서만 유지 (45~58자 범위 강제). `mode="all"`에서도 passage_summary 호출이 자체적으로 retry하므로 자동 적용됨.

**재생성 다양화 정책**:
- topic / title / exam_summary 재생성 시 프론트가 `previous: { topic|title|one_sentence_summary }`를 함께 전송.
- 백엔드는 `previous`가 있으면 `runSingleMode`에 `temperature: 0.85` + system prompt 끝에 `[재생성 지시]` 블록(직전 답 + 다른 각도/명사 선택 요구)을 append.
- `previous` 미동봉 시(첫 호출/fallback) 기존 `temperature 0.25` 유지 → 첫 생성 톤·품질 보존.
- `mode="all"` 병렬 호출 경로는 손대지 않음 (항상 0.25, previous 없음).
- `passage_summary`는 length 강제가 우선이라 재생성 다양화 대상에서 제외.

**프론트 호출 매핑** (`src/pages/Preview.tsx`):
- `handleGenerate` → `{ passage, grade }` (mode 미지정 → 백엔드 "all")
- `regenExamTopic` → `{ mode: "topic", grade }`
- `regenExamTitle` → `{ mode: "title", grade }`
- `regenExamSummary` → `{ mode: "exam_summary", grade }`
- `regenSummary` → `{ mode: "passage_summary" }` (학년 영향 없음)

**grade 추출/전파**:
- `src/lib/grade-utils.ts` `extractGradeFromSchoolName(school.name)` — `/고\s*([1-3])/` 정규식, 폴백 = 2.
- `Index.tsx`의 Preview 진입 navigate state에 `grade` 포함.
- `Preview.tsx`는 `location.state.grade` → sessionStorage(`preview-state.grade`) 캐시 → 폴백 2 순으로 결정.

**Fallback**: `invokeWithFallback` 헬퍼가 mode 호출 실패/빈 응답 시 자동으로 mode 미지정으로 재호출.

**수정 가이드**:
- topic 톤 수정 → `PROMPT_TOPIC_RULES`만 건드리면 됨
- summary 길이/스타일 → `PROMPT_PASSAGE_SUMMARY_RULES`만
- 4개 영역 공통 규칙 → `PROMPT_COMMON_RULES`
- 첫 생성(all)도 모듈 프롬프트를 사용하므로 모듈 변경은 첫 생성·재생성 양쪽에 동시 반영됨.
- 새로운 영역 추가 시: (1) 모듈 프롬프트 상수 추가 (2) `Mode` 타입에 추가 (3) `buildSystemPrompt` switch 추가 (4) `mode="all"` 병렬 호출 배열에 launch 추가 (5) merge 함수에 pick 추가.