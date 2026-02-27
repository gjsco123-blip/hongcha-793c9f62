

## 엔진 모델 전환: `openai/gpt-5-mini`

**파일**: `supabase/functions/engine/index.ts`

**변경 내용**: model 값을 `"google/gemini-2.5-flash"`에서 `"openai/gpt-5-mini"`로 변경 (1줄 수정)

다른 edge function들(`analyze-single-vocab`, `spellcheck` 등)은 기존 모델 유지. 메인 분석 엔진만 전환.

