

# + 버튼으로 추가한 동반의어에 한국어 뜻이 없는 문제

## 원인
`enrich-synonym` 엔진 프롬프트에 "Every word must include a Korean meaning in parentheses"라고 지시하지만, AI가 간헐적으로 한국어 뜻 없이 영어만 반환하는 경우가 있음 (예: `comprehensive`, `pervasive`, `narrow`, `insignificant`).

현재 클라이언트 측에는 AI가 뜻을 빠뜨렸을 때 보정하는 로직이 없어서, AI 응답 그대로 화면에 표시됨.

## 해결 방향
두 겹으로 방어:

### 1) 엔진 프롬프트 강화 (enrich-synonym)
- 출력 예시를 더 명확히 하고, "괄호 없는 단어는 무효" 규칙 추가
- `"synonyms": "extensive(광범위한), widespread(널리 퍼진)"` 같은 구체적 예시 포함

### 2) 클라이언트 후처리 (Preview.tsx)
- `handleEnrichRow`에서 AI 응답을 merge하기 전에, 각 칩(단어)에 `(한국어)` 괄호가 없으면 해당 칩을 제거하는 필터 추가
- 이미 존재하는 `sanitizeSynonymItems`는 형태 정규화만 하고, 뜻 누락 검증은 안 하므로 별도 필터 필요

```typescript
// 간단한 필터 로직
const ensureKoreanMeaning = (chips: string) =>
  chips.split(",").map(c => c.trim()).filter(c => /\([^)]+\)/.test(c)).join(", ");
```

## 수정 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/enrich-synonym/index.ts` | 프롬프트에 "괄호 없는 단어 금지" 규칙 + 구체적 예시 추가 |
| `src/pages/Preview.tsx` | `handleEnrichRow`와 `handleSynonymWordClick`에서 merge 전 한국어 뜻 없는 칩 필터링 |

## 기존 기능 영향
- 없음. 이미 뜻이 있는 정상 응답은 필터를 통과하므로 기존 동작 변화 없음
- sanitizer 로직 변경 없음

