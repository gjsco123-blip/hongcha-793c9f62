

# 구문분석 자동 생성 시 `},{targetText:` 노출 버그 수정

## 원인
`supabase/functions/grammar/index.ts`에서 자동 생성 모드의 `max_tokens`가 **800**으로 설정되어 있어, 포인트가 3~5개이고 targetText까지 포함되면 JSON이 중간에 잘림. `safeJsonParse`가 잘린 JSON을 억지로 복구하면서 `},{targetText:` 같은 raw JSON 조각이 마지막 포인트의 `text`에 섞여 들어감.

## 수정 사항 (`supabase/functions/grammar/index.ts`)

1. **`max_tokens` 증가**: 800 → 1500 (auto 모드는 최대 5개 포인트 + targetText라 넉넉히)
2. **텍스트 정리 로직 추가**: `autoPoints` 후처리에서 JSON 잔여물(`},{`, `targetText:`, `"text":` 등) 패턴을 strip하는 안전장치 추가

