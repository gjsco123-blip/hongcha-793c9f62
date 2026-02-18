

## 구문분석 모델 업그레이드

`supabase/functions/grammar/index.ts`에서 모델을 변경합니다.

### 변경 내용
- `google/gemini-2.5-flash-lite` → `google/gemini-2.5-flash`
- 비용과 속도는 약간 증가하지만, 문맥 파악 및 분석 정확도가 개선됨

### 수정 파일
- `supabase/functions/grammar/index.ts` (model 값 1줄 변경)

