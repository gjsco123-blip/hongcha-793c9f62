

# enrich-synonym content null 에러 수정 (모델 변경 없음)

## 원인
`gemini-3-flash-preview`가 "Output ONLY valid JSON" 프롬프트를 간헐적으로 tool call로 해석해서 `message.content`가 null이고 `message.tool_calls[0].function.arguments`에 결과를 넣는 현상.

## 수정 내용

### `supabase/functions/enrich-synonym/index.ts`

모델 유지, content 추출 부분에 fallback 로직 추가:

```typescript
const message = data.choices?.[0]?.message;
let content = message?.content;

// Fallback: model이 tool_calls로 응답한 경우
if (!content && message?.tool_calls?.[0]?.function?.arguments) {
  content = message.tool_calls[0].function.arguments;
}

if (!content) {
  console.error("AI response message:", JSON.stringify(message));
  throw new Error("No content in response");
}
```

이것만으로 기존 모델 그대로 유지하면서 null content 에러 해결됨.

## 수정 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/enrich-synonym/index.ts` | content null 시 tool_calls fallback 추가 (약 5줄) |

## 기존 기능 영향
- 없음. 정상 content 응답은 기존과 동일하게 처리됨

