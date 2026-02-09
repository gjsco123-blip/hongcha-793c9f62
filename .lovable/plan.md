

## 프롬프트 강화 + 청크 검증/자동 재시도

### 변경 1: 프롬프트 강화

시스템 프롬프트의 CRITICAL RULES 섹션에 더 명확한 지시를 추가:

- 접속사(while, but, although 등)를 절대 누락하지 말 것
- 영어 원문의 **모든 단어**가 반드시 하나의 청크에 포함될 것
- 영어 문장 전체를 청크로 이어붙이면 원문과 동일해야 한다는 규칙 추가

추가할 규칙 예시:
```
- EVERY word in the original sentence MUST appear in exactly one chunk. No word may be omitted.
- Conjunctions (while, but, although, because, etc.) MUST be included as part of a chunk, never dropped.
- Concatenating all english chunks must reconstruct the original sentence exactly.
```

---

### 변경 2: 청크 수 검증 + 자동 재시도 (최대 2회)

AI 응답을 받은 후, 영어 청크 수와 한국어 청크 수를 비교해서 다르면 자동으로 재시도하는 로직 추가.

**검증 로직:**
1. `english_tagged`에서 `<cN>` 태그 수를 셈
2. `korean_literal_tagged`에서 `<cN>` 태그 수를 셈
3. 두 수가 다르면 재시도 (최대 2회 재시도, 총 3번 시도)
4. 3번 모두 실패하면 마지막 결과를 그대로 반환

**흐름:**
```
AI 호출 → 결과 검증 → 청크 수 일치? → Yes → 반환
                                    → No → 재시도 (최대 2회)
```

---

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| supabase/functions/engine/index.ts | 1. 시스템 프롬프트에 누락 방지 규칙 추가<br>2. 태그 수 세는 헬퍼 함수 추가<br>3. AI 호출을 루프로 감싸서 검증 실패 시 최대 2회 재시도<br>4. 재시도 시 "이전 결과가 잘못되었다"는 피드백 메시지 포함 |

---

### 기술 상세

**태그 카운트 함수:**
```typescript
function countTags(tagged: string): number {
  return (tagged.match(/<c\d+>/g) || []).length;
}
```

**재시도 루프 구조:**
- 최대 3번 시도 (1번 시도 + 2번 재시도)
- 재시도 시 user 메시지에 "이전 결과에서 태그 수가 맞지 않았다. 다시 정확하게 해달라"는 피드백 추가
- 마지막 시도 결과는 검증 실패해도 그대로 반환 (응답 없는 것보다 나음)

