

# "feed" → "fe" 변환 버그 수정

## 원인

`synonym-sanitizer.ts`의 `toBaseToken` 함수(181줄)에서 `-ed`로 끝나는 단어를 무조건 과거형으로 판단하고 `-ed`를 제거함.

"feed"는 원형 자체가 `-eed`로 끝나는 단어인데, `clean.endsWith("ed")` 조건에 걸려 `"fe"`로 잘못 변환됨. 같은 문제가 "seed", "need", "speed", "bleed", "breed", "weed", "proceed", "exceed", "succeed" 등에도 발생 가능.

## 해결 (`src/lib/synonym-sanitizer.ts`)

### `-ed` 제거 전 보호 목록 추가 (181줄 앞)

`-eed`로 끝나는 단어들은 원형이므로 `-ed` 제거 대상에서 제외:

```typescript
// 181줄 직전에 추가
const STEM_ED_EXCEPTIONS = new Set([
  "feed", "seed", "need", "speed", "bleed", "breed", "weed",
  "proceed", "exceed", "succeed", "heed", "deed", "reed",
  "creed", "greed", "steed", "freed",
]);

if (clean.endsWith("ed") && clean.length > 3) {
  if (STEM_ED_EXCEPTIONS.has(clean)) return clean;  // ← 새로 추가
  let base = clean.slice(0, -2);
  // ... 기존 로직
}
```

더 일반적인 패턴으로, `-eed`로 끝나면서 `IRREGULAR_BASE`에 없는 단어는 원형으로 보호하는 규칙도 가능:

```typescript
if (clean.endsWith("eed")) return clean;  // feed, seed, need 등 모두 보호
```

### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/lib/synonym-sanitizer.ts` | `toBaseToken` 181줄: `-eed` 끝나는 단어 보호 규칙 추가 |

## 기존 기능 영향
없음. "needed" → "need", "seeded" → "seed" 등은 `-eed`가 아닌 `-eeded`이므로 이 규칙에 해당하지 않고, 기존 `-ed` 제거 로직이 정상 작동함.

