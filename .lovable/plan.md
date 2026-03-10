

## 모델 전환: `google/gemini-3-flash-preview`

4개 edge function의 모델을 `google/gemini-2.5-flash` → `google/gemini-3-flash-preview`로 변경합니다.

### 변경 대상

| 파일 | 현재 모델 | 변경 후 |
|------|-----------|---------|
| `supabase/functions/engine/index.ts` (line 210) | `google/gemini-2.5-flash` | `google/gemini-3-flash-preview` |
| `supabase/functions/hongt/index.ts` (line 117) | `google/gemini-2.5-flash` | `google/gemini-3-flash-preview` |
| `supabase/functions/grammar/index.ts` (line 289) | `google/gemini-2.5-flash` | `google/gemini-3-flash-preview` |
| `supabase/functions/grammar/index.ts` (line 382) | `google/gemini-2.5-flash` (freestyle 모드) | `google/gemini-3-flash-preview` |

### 변경하지 않는 것
- `spellcheck` (gemini-2.5-flash-lite 유지)
- `regenerate` (이미 gemini-3-flash-preview)
- `analyze-vocab`, `analyze-single-vocab`, `analyze-preview`, `analyze-structure` (별도 요청 없음)

각 파일에서 model 문자열 1줄씩만 수정, 총 4곳.

