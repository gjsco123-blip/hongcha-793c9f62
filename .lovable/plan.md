# analyze-preview 프롬프트 모듈화

## 목표
주제/제목/요약/4단논리 각각을 **독립적으로 수정**할 수 있도록 거대한 단일 프롬프트를 의미 단위 블록으로 쪼갠다.

**핵심 원칙: 모델에게 전달되는 최종 문자열은 100% 동일해야 함** → 품질 변화 없음, 순수 리팩터링.

## 대상 파일
`supabase/functions/analyze-preview/index.ts` 1개 파일만 수정.

## 분리 후 구조

```text
┌─ COMMON_ROLE_AND_ANALYSIS  (공통)
│   - CRITICAL LENGTH RULE (최우선 규칙)
│   - 역할 설명 + Sample Correct Answers
│   - Step 1. Difficulty
│   - Step 2. Internal Analysis
│   - Step 3. Abstraction Adjustment
│
├─ TOPIC_RULE              (주제만)
│   - exam_block.topic 스펙
│   - exam_block.topic_ko 스펙
│
├─ TITLE_RULE              (제목만)
│   - exam_block.title 스펙
│   - exam_block.title_ko 스펙
│
├─ ONE_SENTENCE_SUMMARY_RULE  (한 줄 요약만)
│   - one_sentence_summary 스펙
│   - one_sentence_summary_ko (직역) 스펙 + 예시
│
├─ PASSAGE_LOGIC_RULE      (4단 논리만)
│   - summary 4줄 ①②③④ 스펙
│   - 길이 강제 규칙
│   - 모범/Bad 예시 (Few-shot)
│   - 종결 스타일 (명사형)
│
├─ COMMON_EXAM_RULES       (공통)
│   - Critical Korean Exam Rules
│
└─ OUTPUT_FORMAT           (공통)
    - OUTPUT SELF-CHECK
    - 절대 규칙
    - JSON 출력 형식

const SYSTEM_PROMPT = [
  COMMON_ROLE_AND_ANALYSIS,
  TOPIC_RULE,
  TITLE_RULE,
  ONE_SENTENCE_SUMMARY_RULE,
  PASSAGE_LOGIC_RULE,
  COMMON_EXAM_RULES,
  OUTPUT_FORMAT,
].join("\n\n");
```

`SELF_CRITIQUE_PROMPT`도 동일 원칙으로 4개 체크 블록으로 분리:

```text
TOPIC_CHECK + TITLE_CHECK + SUMMARY_CHECK + PASSAGE_LOGIC_CHECK
→ const SELF_CRITIQUE_PROMPT = [...].join("\n\n");
```

## 작업 순서

1. 현재 `SYSTEM_PROMPT` 텍스트를 의미 단위로 잘라 7개 `const` 문자열로 분리
2. `SYSTEM_PROMPT`는 위 7개를 `join("\n\n")`으로 조립
3. `SELF_CRITIQUE_PROMPT`도 4개 체크 블록으로 동일하게 분리
4. 각 블록 위에 `// ── 주제 (Topic) 규칙 ──` 같은 한글 주석 헤더 추가 → 검색/수정 시 즉시 점프 가능
5. 함수 로직(`callAi`, `serve`, retry, self-critique 호출)은 **일체 변경 없음**

## 보장 사항

- 최종 프롬프트 문자열 길이/내용 동일 (단순 변수 분리)
- AI 호출 횟수, 모델, temperature, retry 로직 모두 그대로
- 출력 JSON 스키마 변경 없음 → 클라이언트 코드 수정 불필요
- 사용자 체감 품질 변화 0

## 솔직한 한계

- 분리 자체는 가독성 개선용이지 품질 향상은 없음 (네가 이미 동의한 부분)
- 블록 사이 `\n\n` 결합 방식이라 원본 대비 공백 1~2개 차이가 생길 수 있음 → 모델 출력에 사실상 영향 없지만, 1:1 바이트 동일은 아님
- 향후 "Topic만 수정" 같은 작업은 쉬워지지만, 공통 블록(분석 단계 등) 수정은 여전히 4개 필드 모두에 영향

## 향후 효과

- "주제 톤만 더 학술적으로" → `TOPIC_RULE`만 수정
- "4단 논리 길이 50~60으로" → `PASSAGE_LOGIC_RULE`만 수정
- 코드 리뷰/diff 가독성 대폭 향상

진행해도 될까?
