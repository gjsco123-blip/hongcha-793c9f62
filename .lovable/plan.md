

# synonym-sanitizer.ts 버그 분석 결과

현재 코드에서 발견된 문제 **3가지**:

---

## 버그 1: "dated" → "dat" (무음 e 복원 누락)

**위치**: `toBaseToken()` line 169-177

`-ed` 제거 후 무음 e를 복원하지 않음.

| 입력 | 현재 결과 | 올바른 결과 |
|------|----------|------------|
| dated | dat | date |
| created | creat | create |
| celebrated | celebrat | celebrate |
| influenced | influenc | influence |
| recognized | recogniz | recognize |

**원인**: line 177에서 `return base;`만 하고 끝남. `모음+자음` 패턴(dat, creat 등)일 때 `e`를 붙여야 함.

**수정**: `-ed` 제거 후 `/[aeiou][^aeiou]$/` 패턴이면 `base + "e"` 반환

---

## 버그 2: `-ing` 제거에도 같은 문제

**위치**: `toBaseToken()` line 157-164

| 입력 | 현재 결과 | 올바른 결과 |
|------|----------|------------|
| creating | creat | create |
| celebrating | celebrat | celebrate |
| influencing | influenc | influence |
| recognizing | recogniz | recognize |
| dating | dat | date |

**원인**: line 164에서도 동일하게 `return base;`만 하고 무음 e 미복원.

**수정**: `-ed`와 동일한 휴리스틱 적용

---

## 버그 3: `paid`, `said`, `laid` 등 불규칙 동사 누락

**위치**: `IRREGULAR_BASE` 맵

| 입력 | 현재 결과 | 올바른 결과 |
|------|----------|------------|
| paid | paid | pay |
| said | said | say |
| laid | laid | lay |

**원인**: 이 단어들은 `-ed`로 끝나지 않아서 어떤 규칙에도 안 걸림.

---

## 수정 계획

### `src/lib/synonym-sanitizer.ts`

1. **IRREGULAR_BASE에 추가**: `paid: "pay"`, `said: "say"`, `laid: "lay"`

2. **무음 e 복원 헬퍼 추가**:
```text
shouldRestoreSilentE(base) → base + "e"
조건: /[aeiou][^aeiouwxy]$/ 패턴 (dat→date, creat→create)
예외: help, want 같은 자음+자음은 해당 안 됨
```

3. **두 곳에 적용**:
   - `-ed` 제거 후 (line 177)
   - `-ing` 제거 후 (line 164)

### `src/lib/synonym-sanitizer.test.ts`

- "dated back to" → "date back to" 테스트
- "paid attention to" → "pay attention to" 테스트
- "creating" → "create" 테스트

