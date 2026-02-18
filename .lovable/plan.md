

## 동사 밑줄 정확도 개선

### 문제점
- to부정사(to cause, to switch off)가 동사로 태깅됨
- 전치사(of, upon)가 동사로 태깅됨
- 프롬프트에 규칙이 이미 있지만 모델이 무시함

### 수정 1: 모델 업그레이드 (supabase/functions/engine/index.ts)
- `google/gemini-2.5-flash` → `google/gemini-2.5-pro`로 변경
- Pro 모델이 복잡한 언어학적 규칙을 더 정확하게 따름

### 수정 2: 프롬프트 간소화 및 강화 (supabase/functions/engine/index.ts)
현재 프롬프트의 동사 관련 규칙이 너무 길고 분산되어 있음. 핵심 규칙을 더 명확하고 간결하게 정리:

- 동사 태깅 규칙을 별도 섹션으로 분리하여 강조
- "절대 하지 말 것" 목록을 앞쪽에 배치 (모델이 앞부분 규칙을 더 잘 따름)
- Few-shot 예시 추가: 올바른 태깅 vs 잘못된 태깅을 구체적으로 보여줌
- 특히 to-infinitive, 전치사 오태깅 방지 예시 강화

### 수정 파일
- `supabase/functions/engine/index.ts` (model 변수 + systemPrompt 내 verb 규칙 부분)

### 트레이드오프
- Pro 모델은 flash 대비 응답 시간이 약간 느리고 비용이 높음
- 정확도는 눈에 띄게 개선됨
