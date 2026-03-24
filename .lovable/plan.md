

# 채팅 앵무새 반복 + 고정패턴 미적용 — 3가지 근본 원인 동시 수정

## 현재 코드에서 확인된 문제

### 문제 1: `chatMaterializePinnedPattern` — `___` 없으면 패턴 완전 무시
```
Line 188-190:
if (!template.includes("___")) {
  return normalizedRaw;  // ← AI 출력 그대로 반환, 패턴 강제 없음
}
```
DB의 고정 패턴 대부분은 `___`가 없음. 따라서 **후처리에서 패턴이 한 번도 적용되지 않음**.

### 문제 2: 재분석 시 이전 틀린 답변이 히스토리에 그대로 남음
```
Line 443-449:
const aiMessages = [
  { role: "system", content: ... },
  { role: "system", content: contextBlock },
  ...messages,  // ← 이전 틀린 assistant 답변 포함
];
```
`chatWantsReanalysis`가 true여도 시스템 프롬프트만 바뀌고, 이전 대화에서 틀린 assistant 메시지가 그대로 컨텍스트에 남아 모델이 앵커링됨.

### 문제 3: 태그당 패턴 수 제한 없음
로그: `Matched 9/54 patterns` — 분사 태그 하나에 9개 패턴이 주입됨. 여전히 과부하.

## 수정 계획

### 1. `chatMaterializePinnedPattern` — `___` 없어도 한국어 구조 강제

`___`가 없는 패턴일 때:
- 템플릿에서 한국어 구조(설명 패턴, 종결어미)를 추출
- AI 출력에서 영어 단어/구문을 추출
- 템플릿의 영어 부분만 AI 출력의 영어로 교체하여 반환
- 교체 실패 시(영어 추출 불가 등) AI 출력 그대로 반환 (안전 폴백)

### 2. 재분석 모드에서 이전 assistant 메시지 필터링

`chatWantsReanalysis`가 true일 때:
- `messages` 배열에서 마지막 user 메시지 직전의 assistant 메시지를 제거하거나, `[이전 답변은 오류로 판정됨 — 무시하라]`로 교체
- 이렇게 하면 모델이 자기 이전 답변에 앵커링되지 않음

### 3. 태그당 패턴 최대 2개로 제한

`relevantPatterns` 구성 시 같은 `tagKey`에 대해 최대 2개까지만 포함.

## 수정 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/grammar-chat/index.ts` | 위 3가지 수정 모두 적용 |

## 기대 결과
- 고정 패턴의 한국어 말투/구조가 실제로 출력에 강제됨
- "틀렸어" 후 이전 오답이 컨텍스트에서 제거되어 새로운 분석 가능
- 패턴 수 제한으로 모델 혼란 최소화

