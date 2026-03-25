

# splitKoreanPhrases 과도한 분리 수정

## 문제
`"~보다 더 중요하다"`는 하나의 의미 단위인데, `splitKoreanPhrases`의 정규식 `/[^,]+?다(?=\s|$)/g`가 `"~보다"`와 `"더 중요하다"`를 별도 구문으로 인식하여 콤마를 자동 삽입함.

## 원인
`normalizeKoreanMeaning` → `splitKoreanPhrases`가 `다`로 끝나는 모든 토큰을 개별 구문으로 간주.

## 수정 방안 — `src/lib/synonym-sanitizer.ts`

`splitKoreanPhrases` 함수의 자동 분리 조건을 강화:
- 현재: `다`로 끝나는 모든 구간을 분리
- 수정: **콤마가 명시적으로 있을 때만 분리**하고, 콤마 없는 텍스트는 하나의 구문으로 유지

구체적으로 122~126행의 정규식 기반 자동 분리 로직을 제거하고, 콤마 기반 분리만 남김:

```typescript
const splitKoreanPhrases = (text: string) => {
  const cleaned = normalizeSpaces(text);
  if (!cleaned) return [];
  if (cleaned.includes(",")) 
    return cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  return [cleaned];
};
```

이렇게 하면 사용자가 콤마를 지우면 하나의 구문으로 유지되고, 콤마로 구분한 경우에만 분리됨.

## 영향 범위
- `normalizeKoreanMeaning` → `splitEntry`의 한국어 부분 정규화에만 영향
- 모델이 콤마 없이 여러 뜻을 반환하는 경우 자동 분리가 안 될 수 있으나, 실제로 모델 출력은 대부분 콤마로 구분되어 있어 영향 미미

