

# 직역/의역 존댓말 → 반말 이중 방어

## 문제
- engine: 프롬프트에 반말 규칙 있으나 AI가 가끔 무시. 후처리 없음.
- regenerate: 반말 규칙 자체가 프롬프트에 없음. 후처리도 없음.

## 해결: 프롬프트 강화 + 후처리 함수 (이중 방어)

### 1. `supabase/functions/engine/index.ts`
- 최종 결과 반환 전에 `sanitizeKorean()` 후처리 함수 적용
- `korean_literal_tagged`와 `korean_natural` 모두에 적용
- 존댓말 어미를 반말로 자동 치환:
  - `~합니다` → `~한다`, `~했습니다` → `~했다`
  - `~됩니다` → `~된다`, `~되었습니다` → `~되었다`
  - `~입니다` → `~이다`, `~있습니다` → `~있다`
  - `~됐습니다` → `~됐다`, `~봅니다` → `~본다` 등

### 2. `supabase/functions/regenerate/index.ts`
- 프롬프트에 반말 종결 규칙 추가 (engine과 동일)
- 결과 반환 전에 동일한 `sanitizeKorean()` 후처리 적용

### sanitizeKorean 함수 (두 파일 모두에 추가)
```typescript
function sanitizeKorean(text: string): string {
  return text
    .replace(/했습니다/g, '했다')
    .replace(/합니다/g, '한다')
    .replace(/됩니다/g, '된다')
    .replace(/되었습니다/g, '되었다')
    .replace(/됐습니다/g, '됐다')
    .replace(/입니다/g, '이다')
    .replace(/있습니다/g, '있다')
    .replace(/없습니다/g, '없다')
    .replace(/갑니다/g, '간다')
    .replace(/옵니다/g, '온다')
    .replace(/줍니다/g, '준다')
    .replace(/봅니다/g, '본다')
    .replace(/납니다/g, '난다')
    .replace(/겁니다/g, '것이다')
    .replace(/습니까/g, '는가')
    .replace(/ᆸ니다/g, '다');  // 포괄적 ㅂ니다 패턴
}
```

기존 구문분석 설명에서 이미 검증된 이중 방어 패턴과 동일한 접근.

