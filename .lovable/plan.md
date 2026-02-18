

## 힌트 기반 구문분석 일관성 개선

### 문제 원인
현재 `hintSystemPrompt`에는 출력 말투 템플릿만 있고, **힌트 입력 → 출력** 매핑을 보여주는 구체적 예시가 없음. 모델이 매번 다른 방식으로 해석하여 결과가 들쭉날쭉함.

### 변경 내용 (`supabase/functions/grammar/index.ts`)

**1. 힌트 프롬프트에 few-shot 예시 추가**
- 실제 힌트 입력과 기대 출력을 짝지어 3개 정도 예시를 추가
- 예: 힌트 "관계대명사" → 출력 형태, 힌트 "수동태" → 출력 형태
- 모델이 패턴을 학습하여 일관된 스타일 유지

**2. 핵심 지시 강화**
- "선택 구문에 포함된 단어를 반드시 인용하여 설명할 것" 규칙 추가
- "힌트 키워드를 문법 용어로 정확히 매핑하여 해당 용법만 설명할 것" 규칙 추가

**3. temperature 파라미터 추가**
- `temperature: 0.2`로 설정하여 출력 변동성 최소화

**4. 사용자 메시지 포맷 구조화**
- 현재: 자유 텍스트 형태
- 변경: 명확한 필드 구분으로 모델이 각 요소를 정확히 인식

### 예시 (프롬프트에 추가될 few-shot)

```
[입출력 예시]
전체 문장: The students who received the scholarship were honored at the ceremony.
선택 구문: who received the scholarship
힌트: 관계대명사
출력:
• 주격 관계대명사 who가 선행사 students를 수식하는 형용사절을 이끔 / who~scholarship 전체가 students를 후치수식함.

전체 문장: A new policy can be implemented to reduce costs.
선택 구문: can be implemented
힌트: 수동태
출력:
• 조동사 can + be p.p. 형태로 수동의 의미를 나타냄.

전체 문장: By using advanced technology, the team solved the problem.
선택 구문: By using advanced technology
힌트: 전치사+동명사
출력:
• 전치사 by 뒤에 동명사 using이 와서 수단/방법을 나타냄.
```

### 수정 파일
- `supabase/functions/grammar/index.ts` (hintSystemPrompt 보강 + temperature 추가)

