---
name: analyze-preview mode 분기 구조
description: analyze-preview 엣지 함수의 mode별 프롬프트 모듈 위치와 호출 매핑
type: feature
---
`supabase/functions/analyze-preview/index.ts`는 mode 파라미터로 5가지 모드 지원: `all` | `topic` | `title` | `exam_summary` | `passage_summary`.

**mode="all" (첫 생성)**: 기존 SYSTEM_PROMPT 통째로 사용. self-critique 1회 + length-retry 1회. 동작 보존 — 절대 건드리지 말 것.

**모듈 프롬프트 (재생성 전용)**:
- `PROMPT_INTRO` — 공통 도입 (난이도/내부 분석)
- `PROMPT_TOPIC_RULES` — topic + topic_ko + Sample Correct Answers 12개
- `PROMPT_TITLE_RULES` — title + title_ko
- `PROMPT_EXAM_SUMMARY_RULES` — one_sentence_summary + 직역 규칙
- `PROMPT_PASSAGE_SUMMARY_RULES` — ①②③④ + 길이 강제(45~58) + Few-shot
- `PROMPT_COMMON_RULES` — Critical Korean Exam Rules
- `PROMPT_OUTPUT_<MODE>` — 모드별 JSON 출력 형식

**합성**: `buildSystemPrompt(mode)` — `[INTRO, <MODE>_RULES, COMMON, OUTPUT_<MODE>].join("\n\n")`

**self-critique/length-retry**:
- `mode="all"` → self-critique + length-retry 둘 다 적용
- `mode="passage_summary"` → length-retry만 적용 (self-critique 생략)
- 나머지 모드 → 둘 다 생략

**프론트 호출 매핑** (`src/pages/Preview.tsx`):
- `handleGenerate` → `{ passage }` (mode 미지정 → 백엔드 "all")
- `regenExamTopic` → `mode: "topic"`
- `regenExamTitle` → `mode: "title"`
- `regenExamSummary` → `mode: "exam_summary"`
- `regenSummary` → `mode: "passage_summary"`

**Fallback**: `invokeWithFallback` 헬퍼가 mode 호출 실패/빈 응답 시 자동으로 mode 미지정으로 재호출.

**수정 가이드**:
- topic 톤 수정 → `PROMPT_TOPIC_RULES`만 건드리면 됨
- summary 길이/스타일 → `PROMPT_PASSAGE_SUMMARY_RULES`만
- 4개 영역 공통 규칙 → `PROMPT_COMMON_RULES`
- 첫 생성(all) 동작은 SYSTEM_PROMPT가 책임 — 모듈 변경이 first generation에 영향 0.