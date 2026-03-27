

# 동사 태깅 프롬프트 — 분사구문/축약절 규칙 추가

## 문제
"when asked", "once completed", "if given" 등 축약된 부사절(reduced adverbial clause)의 과거분사가 서술어(finite verb)로 잘못 태깅됨. 현재 프롬프트에 이 케이스가 명시되어 있지 않음.

## 변경 파일: `supabase/functions/engine/index.ts`

### 메인 프롬프트 + 검증 프롬프트 모두 수정

"What MUST NOT have `<v>` tags" 목록에 **6번 규칙** 추가:

```
6. **Reduced adverbial clauses (분사구문/축약절)**: Past participles after conjunctions like "when", "once", "if", "while", "although", "though", "unless" where "subject + be" is omitted.
   - "when asked" = "when [they are] asked" → "asked" is a participle, NOT a finite verb → NO <v>
   - "once completed" = "once [it is] completed" → NO <v>
   - "if given the chance" → NO <v> on "given"
   - "while surrounded by" → NO <v> on "surrounded"
   - CORRECT: when asked to recall → NO <v> on "asked"
   - WRONG: when <v>asked</v> to recall
   - **Test**: Can you insert "[subject] + [be verb]" between the conjunction and participle? If YES → it's a reduced clause → NO <v>.
```

두 프롬프트(시스템 프롬프트 ~line 130, 검증 프롬프트 ~line 324)에 동일하게 추가.

