

## 구문분석 드래그 힌트 모드 디버깅 및 수정

### 근본 원인 분석

`passesTagFilter`를 제거했음에도 여전히 "(힌트 태그에 해당하는 포인트를 문장에서 찾기 어려움)" 에러가 나오는 이유는 **AI 자체가 빈 points를 반환**하기 때문입니다.

현재 코드 흐름:
1. 사용자가 텍스트 드래그 + 힌트 입력
2. `detectTagsFromHint`로 태그 감지 (예: "5형식" -> `FIVE_PATTERN`)
3. 태그가 감지되면 `useFreestyle = false` -> hint 모드 (gemini-2.5-pro)
4. AI gateway 호출 -> **tool_call 응답이 비어있거나 파싱 실패**
5. `points.length === 0` -> 에러 메시지 표시

가능한 원인 2가지:
- **gemini-2.5-pro 모델이 tool_call 형식 대신 일반 텍스트로 응답**하는 경우, 현재 fallback 로직이 content에서 텍스트를 가져오지만 빈 문자열일 수 있음
- **배포가 반영되지 않았을 가능성** (이전 passesTagFilter가 있는 버전이 캐시되어 실행 중)

### 수정 내용

**파일: `supabase/functions/grammar/index.ts`**

#### 1. AI 응답 디버그 로깅 추가
tool_call이 비어있는 경우를 진단하기 위해 로깅 추가:

```typescript
const data = await response.json();
console.log("AI response:", JSON.stringify(data.choices?.[0]?.message).slice(0, 500));
const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
```

#### 2. Fallback 파싱 강화
tool_call이 없을 때 content에서 JSON을 추출하는 로직을 강화:

```typescript
if (toolCall?.function?.arguments) {
  const parsed = safeJsonParse(toolCall.function.arguments);
  points = Array.isArray(parsed?.points) ? parsed.points : [];
} else {
  // tool_call 실패 시 content에서 points 추출 시도
  const content = data.choices?.[0]?.message?.content ?? "";
  console.log("No tool_call, trying content fallback:", content.slice(0, 300));
  try {
    const parsed = safeJsonParse(content);
    points = Array.isArray(parsed?.points) ? parsed.points : [];
  } catch {
    const fallback = oneLine(content);
    points = fallback ? [fallback] : [];
  }
}
```

#### 3. 강제 재배포
edge function을 명시적으로 재배포하여 캐시된 이전 버전이 실행되는 문제를 방지.

### 수정 파일
- `supabase/functions/grammar/index.ts` (로깅 추가 + fallback 파싱 강화 + 재배포)

