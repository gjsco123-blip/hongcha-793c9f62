

# "focus on" → "focu on" 버그 수정

## 원인

`src/lib/synonym-sanitizer.ts`의 `toBaseToken()` 함수가 문제입니다.

```typescript
// 현재 로직 (line ~129)
if (clean.endsWith("s") && clean.length > 3 && !clean.endsWith("ss")) 
  return clean.slice(0, -1);
```

"focus"가 's'로 끝나니까 복수형/3인칭으로 오인하여 's'를 제거 → **"focu"**

같은 문제가 생길 수 있는 단어들: campus, bonus, status, basis, versus, plus, thus, various, conscious 등

## 해결 방안

`IRREGULAR_BASE`에 예외 단어를 추가하는 것보다, **`-us`, `-is`, `-os` 등 라틴어 계열 어미**를 's' 제거 대상에서 제외하는 조건을 추가하는 게 근본적입니다.

### `src/lib/synonym-sanitizer.ts` — `toBaseToken()` 수정

's' 제거 조건에 다음 패턴을 **제외**:
- `-us` (focus, campus, bonus, status, versus, stimulus, apparatus)
- `-is` (basis, analysis, thesis, crisis)  
- `-os` (chaos, cosmos)
- `-ous` (various, conscious, serious, obvious)
- `-ius` (genius, radius)

```typescript
if (clean.endsWith("s") && clean.length > 3 && !clean.endsWith("ss")
    && !/[uio]s$/.test(clean) && !clean.endsWith("ous"))
  return clean.slice(0, -1);
```

이 한 줄 조건 추가로 라틴어 계열 단어들이 일괄 보호됩니다.

### 테스트 파일 보완
`synonym-sanitizer.test.ts`에 "focus on" 케이스 추가하여 재발 방지.

