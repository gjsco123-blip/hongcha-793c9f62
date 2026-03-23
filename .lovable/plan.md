

# 고정 패턴이 적용되지 않는 문제 수정

## 원인

이전 수정에서 "무관한 패턴 주입 방지"를 위해 **`___` 플레이스홀더가 있는 패턴만** 프롬프트에 주입하도록 제한함 (line 823-826).

```typescript
// 현재 코드 — ___가 없는 패턴은 전부 제외됨
const templatePatterns = relevantPatterns.filter((p: any) => {
  const content = String(p?.pinned_content ?? "");
  return isReusableTemplate(content);  // content.includes("___")
});
```

실제 고정 패턴 대부분은 `___` 없이 작성되어 있으므로, 관련성 점수가 높아도 프롬프트에 들어가지 않음. 즉 **관련성 필터는 잘 작동하는데, 그 뒤의 "템플릿만 허용" 조건이 너무 강해서 전부 차단**되는 상태.

## 수정 방안

1. **`isReusableTemplate` 필터 제거** — 관련성 점수(patternRelevanceScore)가 이미 엄격하게 필터링하므로, 점수를 통과한 패턴은 `___` 유무와 관계없이 프롬프트에 주입
2. **높은 관련성 점수 기준 유지** — phrase match(1.0) 또는 keyword ratio >= 0.6인 패턴만 통과하므로 무관한 패턴 유입은 방지됨
3. **프롬프트 문구 조정** — "템플릿만"이 아닌 "관련 패턴"으로 헤더 변경, "문장에 해당 문법이 실제로 존재할 때만 적용" 지시는 유지

## 수정 파일

`supabase/functions/grammar/index.ts` — lines 820-844

### 변경 내용

```typescript
// 변경 전 (line 823-826)
const templatePatterns = relevantPatterns.filter((p: any) => {
  const content = String(p?.pinned_content ?? "");
  return isReusableTemplate(content);
});
if (templatePatterns.length === 0) return { promptBlock: "", byTag };

// 변경 후 — 관련성 점수 통과한 패턴 전부 허용
// (isReusableTemplate 필터 제거, relevantPatterns 직접 사용)
```

프롬프트 블록도 "템플릿만" → "관련 고정 패턴"으로 변경하되, "문장에 해당 문법이 없으면 무시" 지시는 유지.

## 영향

- 관련성 점수 시스템은 그대로 → "rather than" 같은 무관 패턴은 계속 차단
- 점수를 통과한 패턴은 `___` 유무와 관계없이 프롬프트에 주입 → 고정 패턴 스타일 반영됨

