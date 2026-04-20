

## 주어 태깅 — 전치사구·관계대명사 수정 (B안 채택)

### 결정
- **B안**: 관계절 안의 **목적격 관계절의 진짜 주어(`I` 등)는 `<s>` 허용**
- 단, **주격 관계대명사(`who/which/that`) 자체는 `<s>` 금지**

### 핵심 규칙 (engine/index.ts)

**1. NP 후치수식 엄격 배제 (Option A)**
- `<s>`는 한정사 + 전치 형용사 + head noun까지만
- head noun 뒤 어떤 후치수식도 포함 금지: 전치사구, 관계절, 분사구, to부정사, 동격
- ❌ `<s>something like this thought</s>` → ✅ `<s>something</s> like this thought`
- ❌ `<s>the man with a hat</s>` → ✅ `<s>the man</s> with a hat`
- ❌ `<s>students taking the test</s>` → ✅ `<s>students</s> taking the test`

**2. 관계절 내부 처리 (B안)**
- **주격 관계절** (`who/which/that` + V): 관계대명사 자체에 `<s>` 금지 → 관계절 청크에 `<s>` 없음, `<v>`만
  - ✅ `<s>the people</s> who <v>are taking</v> part in it`
  - ❌ `<s>who</s> are taking part`
- **목적격 관계절** (`who/which/that` + S + V): 관계절 안의 진짜 주어는 `<s>` 허용
  - ✅ `<s>the book</s> that <s>I</s> <v>read</v>`
  - ✅ `<s>the man</s> whom <s>she</s> <v>met</v>`
- 규칙 요약: **관계대명사가 관계절의 주어 역할이면 `<s>` 안 침**, 관계대명사가 목적어 역할이면 그 뒤 진짜 주어를 `<s>` 침

**3. Subject verification pass 강화**
- `<s>` 안에 후치수식 토큰 있으면 head noun까지 잘라냄
- `<s>` 안에 관계대명사(`who/whom/which/that/whose`)가 있으면 제거
- 청크 첫 토큰이 관계대명사 + 바로 `<v>`가 오면 → 그 청크 안의 `<s>` 모두 제거 (주격 관계절)
- 청크 첫 토큰이 관계대명사 + NP + `<v>` 패턴이면 → NP를 `<s>`로 인정 (목적격 관계절)

**4. 메모리 업데이트**
`mem://features/subject-underline.md`:
- "Option A 엄격 적용: head noun 뒤 후치수식 절대 포함 금지"
- "주격 관계절: `<s>` 없음 / 목적격 관계절: 내부 주어 `<s>` 허용"

### 변경 파일
- `supabase/functions/engine/index.ts`
- `.lovable/memory/features/subject-underline.md`

### 검증 케이스
1. `something like this thought ...` → `<s>something</s>`만
2. `the people who are taking part in it` → `<s>the people</s>`만, 관계절 청크 안 깨끗
3. `the book that I read` → `<s>the book</s>`, `<s>I</s>` 둘 다 (B안)
4. (회귀) `What he said is true` → 명사절 내부 `<s>he</s>`만
5. (회귀) `Locking-in prices ...` → `<s>Locking-in prices</s>`
6. (회귀) `The policy allows citizens ...` → `<s>The policy</s>`만

### 기존 데이터
엔진 수정 후 현재 지문 **재분석 필요**.

