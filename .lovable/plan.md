

## grammar 힌트 프롬프트 개선

### 문제점
현재 `hintSystemPrompt`가 단순히 문법 용어를 나열하는 수준. 사용자가 원하는 것:
1. 선택한 구문뿐 아니라 **전체 문장 맥락**을 파악해서 설명
2. 문법 용어만 나열이 아니라 **그 문장에서 어떻게 쓰였는지** 구체적으로
3. 길어지면 `who~scholarship` 식으로 **물결 축약** 사용
4. 설명에 큰따옴표(`" "`) 제거

### 수정 내용

**파일: `supabase/functions/grammar/index.ts`**

1. `hintSystemPrompt` 개선:
   - 전체 문장(sentence)도 함께 제공하도록 프롬프트에 명시
   - "문장 전체 맥락을 파악한 뒤, 사용자가 지정한 포인트를 해당 문장에서 어떤 역할을 하는지 구체적으로 설명하라" 지시 추가
   - 3단어 이상의 영어 구문은 `첫단어~마지막단어` 형태로 축약하라는 규칙 추가
   - 출력에 큰따옴표(`"`) 사용 금지 규칙 추가
   - 템플릿 예시에서도 큰따옴표 제거

2. `userMessage` 변경:
   - 힌트 모드일 때 전체 문장(sentence)과 선택 구문(selectedText)을 모두 전달
   - 형식: `전체 문장: "..."\n선택 구문: "..."\n힌트: ...`

3. `baseSystemPrompt`의 템플릿 예시에서도 큰따옴표 제거 (일관성)

### 변경 전후 비교

변경 전 (힌트: "관계대명사, 수동태"):
```
• 주격 관계대명사 which가 선행사를 수식함.
• 수동태 were conducted가 사용됨.
```

변경 후:
```
• 주격 관계대명사 which가 선행사 studies를 수식하는 형용사절을 이끌며, which~abroad 전체가 studies를 후치수식함.
• were conducted는 conduct의 수동태로, 연구가 수행된 대상임을 나타냄.
```

### 수정 파일
- `supabase/functions/grammar/index.ts` (프롬프트 2곳 + userMessage 1곳)

