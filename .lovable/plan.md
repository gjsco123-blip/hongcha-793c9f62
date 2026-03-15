

# "~임" 종결 근절: 프롬프트 강화 + 후처리 안전장치

## 핵심 인사이트

프롬프트 규칙만으로는 모델이 100% 따르지 않습니다. **두 겹 방어**가 필요합니다:
1. 프롬프트 강화 (모델이 최대한 따르도록)
2. 코드 후처리 (빠져나온 "~임"을 자동 제거)

## 변경 사항

### 1. `supabase/functions/grammar/index.ts` — 프롬프트 3곳 + 후처리

**프롬프트 변경** (buildDrag/Hint/AutoSystemPrompt 모두):
- 기존: 문체 예시 끝에 금지 규칙 1줄
- 변경: `[절대 규칙]` 섹션 안에 금지 규칙을 이동시키고, Bad→Good 예시 추가

```
- "~임", "~됨", "~함", "~있음" 종결 절대 금지. 아래 변환을 따를 것:
  ✗ 역할임 → ✓ 역할 / ✗ 구조임 → ✓ 구조 / ✗ 수일치함 → ✓ 수일치
```

**후처리 함수 추가** — AI 응답에서 `~임`, `~됨`, `~함` 등을 자동 제거하는 `sanitizeEndings()`:
```typescript
function sanitizeEndings(text: string): string {
  return text.replace(/(?:임|됨|있음)(?=[.\s/,]|$)/g, (match, offset, str) => {
    // "임" 앞 글자가 한글이면 제거, 아니면 유지
    const prev = str[offset - 1];
    if (prev && /[가-힣]/.test(prev)) return '';
    return match;
  });
}
```

이 함수를 `syntax_result` tool call 파싱 후 각 point에 적용.

### 2. `supabase/functions/grammar-chat/index.ts` — 프롬프트 + 후처리

- 수정안 규칙에서 금지 규칙을 Bad→Good 예시로 교체 (프롬프트)
- `suggestionNotes` 파싱 후 동일한 `sanitizeEndings()` 적용 (후처리)

## 왜 이게 더 나은가

| 기존 | 개선안 |
|------|--------|
| 프롬프트 규칙 1줄만 | 절대 규칙 섹션에 Bad→Good 포함 |
| 모델이 무시하면 끝 | 후처리가 잡아냄 → 100% 방지 |

