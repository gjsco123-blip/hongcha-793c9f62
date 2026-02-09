

## engine 함수 모델 변경: gemini-2.5-pro → gemini-2.5-flash

개발 단계에서 비용을 절감하기 위해 분석 모델을 변경합니다.

### 변경 내용

**supabase/functions/engine/index.ts** - 모델명 1줄 변경

`google/gemini-2.5-pro` → `google/gemini-2.5-flash`

나중에 품질을 높이고 싶을 때 다시 `gemini-2.5-pro`로 변경하면 됩니다.

### 기술 요약

| 파일 | 변경 |
|------|------|
| supabase/functions/engine/index.ts | model 값을 `google/gemini-2.5-flash`로 변경 |

