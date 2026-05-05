## 문제

`analyze-preview` 엣지 함수의 topic 모드를 직접 호출해 보니 응답이 다음과 같이 옵니다:

```json
{ "exam_block": { "topic": "...", "topic_ko": "..." } }
```

새 스키마(`topic_basic`, `topic_basic_ko`, `topic_advanced`, `topic_advanced_ko`)가 비어 있어서 프론트 normalize가 `topic → topic_basic`으로 매핑 → **기본형만 보이고 고급형은 빈칸**으로 표시됩니다.

## 원인

`supabase/functions/analyze-preview/index.ts`의 topic 프롬프트가 충돌합니다.
- `PROMPT_TOPIC_RULES_G3` / `_G12` 본문 전체가 단수 `topic` / `[topic_ko 규칙]` 표현 → 모델이 "한 개만"으로 해석
- 출력 포맷(`PROMPT_OUTPUT_TOPIC`)만 4개 필드 요구 → 본문에 묻혀 무시됨
- 재시도가 같은 system prompt를 재사용 → 같은 옛 스키마 반복

## 수정안

`supabase/functions/analyze-preview/index.ts` 한 파일만 수정.

### 1) Topic 규칙 프롬프트 정리
- `PROMPT_TOPIC_RULES_G12`, `PROMPT_TOPIC_RULES_G3`에서 단수 "topic" 표현을 "각 topic 변형(topic_basic / topic_advanced)"으로 통일.
- 두 프롬프트 끝의 `[topic_ko 규칙]` 블록을 `[topic_basic_ko / topic_advanced_ko 규칙]`로 변경하고, 단수 `topic_ko`라는 단어 자체를 제거.

### 2) 출력 스키마 강제 강화
- `PROMPT_OUTPUT_TOPIC` 위쪽에 다음 한 줄 추가:
  - `반드시 다음 4개 필드를 모두 포함할 것: topic_basic, topic_basic_ko, topic_advanced, topic_advanced_ko. "topic" 또는 "topic_ko" 같은 단수 필드 출력은 금지(출력하면 무효).`

### 3) 서버 사이드 후처리 폴백 (가장 확실한 안전장치)
`runSingleMode`의 topic 분기 끝에 다음 로직 추가:
- 1차 응답에서 `exam_block.topic`만 있고 `topic_basic`이 비어 있으면 → `topic_basic`/`topic_basic_ko`로 옮긴 뒤 advanced 전용 호출을 한 번 더 실행.
- advanced 전용 호출은 새 mini system prompt를 사용:
  - 입력: 지문 + 이미 정해진 basic 영문/한국어
  - 요구: basic과 같은 핵심 주제이지만 다른 head noun/framing의 `topic_advanced` + `topic_advanced_ko` 만 JSON으로 반환
- 이 폴백 결과를 머지해 4개 필드를 모두 채운 응답을 반환.

이렇게 하면 (a) 모델이 새 스키마를 제대로 따르면 1콜로 끝나고, (b) 모델이 옛 스키마로 회귀해도 자동으로 두 번째 콜에서 고급형을 보강합니다.

### 4) 재시도 메시지 보강
기존 `topicVariantsIncomplete` 재시도 사용자 메시지에 `"topic"/"topic_ko" 단수 필드 형태로 답하지 말 것. 반드시 4개 필드.` 한 문장 추가.

## 영향 범위

- 수정: `supabase/functions/analyze-preview/index.ts`
- 자동 재배포 후 첫 생성·재생성 모두에서 고급형 채워짐.

## 검증

배포 후 `supabase--curl_edge_functions`로 같은 지문에 `mode=topic, grade=3` 호출 → 응답 JSON에 4개 필드 모두 비어있지 않은지 확인. 그 후 프리뷰 화면에서 새 지문 생성해 고급형이 표시되는지 확인.
