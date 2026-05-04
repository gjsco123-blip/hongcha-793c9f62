# analyze-preview 병렬 리팩토링 (A안)

## 목표
첫 생성(`mode:"all"`)을 거대 SYSTEM_PROMPT 1회 호출에서 **모듈 프롬프트 4개 병렬 호출**로 전환. 첫 생성과 재생성이 **완전히 동일한 프롬프트**를 사용하게 만들어 톤/품질 일관성 확보. self-critique는 비용 절감을 위해 생략.

## 변경 지점

### 1. `supabase/functions/analyze-preview/index.ts`

**(a) topic 모드 조립에 학년별 예시 추가** (현재 누락된 핵심 보강 포인트)
```ts
case "topic":
  body = [
    PROMPT_INTRO,
    topicExamplesByGrade(grade),   // ← 추가 (현재 mode="all"에만 끼워져 있음)
    PROMPT_TOPIC_RULES,
    PROMPT_COMMON_RULES,
    PROMPT_OUTPUT_TOPIC,
  ].join("\n\n");
  break;
```

**(b) `mode:"all"` 분기를 병렬 4호출로 교체**
```ts
if (mode === "all") {
  const [topicRes, titleRes, examSumRes, passageSumRes] = await Promise.allSettled([
    callMode("topic", passage, grade, apiKey),
    callMode("title", passage, grade, apiKey),
    callMode("exam_summary", passage, grade, apiKey),
    callMode("passage_summary", passage, grade, apiKey),
  ]);

  // 부분 실패 허용: 성공한 것만 머지, 실패는 빈 값 + 경고 로그
  const merged = {
    summary: pickSummary(passageSumRes),
    exam_block: {
      ...pickExamBlock(topicRes),
      ...pickExamBlock(titleRes),
      ...pickExamBlock(examSumRes),
    },
  };
  return jsonResponse(merged);
}
```

**(c) 기존 `SYSTEM_PROMPT` 상수 제거 (215줄)**
- 더 이상 어디서도 참조되지 않음
- `SELF_CRITIQUE_PROMPT`도 제거 (A안에서 미사용)
- `summaryHasOutOfRangeLine` length-retry 헬퍼는 `passage_summary` 모드 호출 내부에서 그대로 사용

**(d) 호출 stagger (rate limit 보호)**
- 4개 동시 발사 대신 50ms 간격으로 순차 발사 후 `Promise.allSettled`로 대기
- 기존 `invokeWithFallback` 429/503 재시도 로직은 그대로 활용

### 2. 프론트엔드
**변경 없음.** `Preview.tsx`의 `handleGenerate`는 여전히 `{ passage, grade }`만 보냄. 응답 형태 (`summary` + `exam_block`) 동일.

### 3. `.lovable/memory/architecture/analyze-preview-modes.md` 업데이트
- "mode:'all' = SYSTEM_PROMPT 사용" 규칙 삭제
- "mode:'all' = 4개 모듈 모드 병렬 호출 후 머지" 로 교체
- "topic 모드 조립에 `topicExamplesByGrade(grade)` 포함" 명시
- self-critique 정책: 전체 생략 (비용/속도 우선)

## 동작 흐름

```text
[Preview 첫 생성]
  invoke("analyze-preview", { passage, grade })
       │
       ▼
[Edge Function: mode="all"]
       │
       ├─ callMode("topic", grade)         ┐
       ├─ callMode("title", grade)         ├─ Promise.allSettled
       ├─ callMode("exam_summary", grade)  │
       └─ callMode("passage_summary")      ┘
                       │
                       ▼
       머지 { summary, exam_block:{topic,title,one_sentence_summary,...} }
                       │
                       ▼
              프론트로 반환 (응답 형태 변경 없음)

[재생성 (영역 1개)]
  invoke("analyze-preview", { passage, mode:"topic", grade })
  → 첫 생성 시 호출된 callMode("topic")과 100% 동일 프롬프트 사용
```

## 잃는 것 / 얻는 것

**얻음**
- 첫 생성 ↔ 재생성 톤 100% 일치
- topic 규칙 수정 시 1곳만 수정 (PROMPT_TOPIC_RULES)
- 부분 실패 허용 (1개 영역 실패해도 나머지 3개는 표시)
- 4개 영역이 4개 모델 호출에 분산 → 각 영역에 대한 모델 attention 향상 가능성

**잃음**
- LLM 호출 4회 (비용 ≈ 1.5~2배). 단 각 호출 프롬프트 길이는 1/4로 짧아져 실제 비용 증가폭은 작음
- Cross-field 일관성 (topic-title-summary가 같은 추론 컨텍스트 공유) — 단 현재도 재생성 시 깨지므로 실질 손실 0
- self-critique pass 제거 → summary 길이/topic 정동사 등의 자체 검수 1회 누락. 단 `length-retry`는 passage_summary에 유지되어 길이 무효 케이스는 자동 재시도됨

## 안전장치
- `Promise.allSettled` → 1개 영역 실패해도 나머지 반환
- `passage_summary`는 `length-retry` 유지 (45~58자 범위 강제)
- 기존 `invokeWithFallback`의 429/503 재시도 그대로
- 학년 prefix는 `gradePrefix(grade)`로 모든 모드 공통 prepend (이미 구현됨)

## 영향 없는 영역
- DB / 스키마 / RLS
- analyze-vocab, analyze-synonyms, syntax, hongt
- 프론트엔드 (Index, Preview, PreviewExamSection, PreviewSummarySection)
- 응답 JSON 구조

## 롤백 플랜
SYSTEM_PROMPT 상수와 기존 mode="all" 분기를 git 되돌리기로 1커밋 복구 가능. 모듈 프롬프트는 그대로 두므로 재생성 기능에 영향 없음.
