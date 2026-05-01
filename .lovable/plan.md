

## `there is/are` 존재구문 — 진짜 주어가 사라지는 문제

### 원인
1. **결정적 가드(`stripObjectSubjectTags`)의 R1 룰이 존재구문에서 오작동**
   - 룰: "동사 이후에 등장하는 `<s>/<ss>`는, 그 뒤에 또 다른 동사가 오지 않으면 목적어로 보고 태그 제거"
   - 존재구문 `there <vs>is</vs> <ss>so little variation</ss> amongst us`는:
     - `is` = 동사
     - `so little variation` = **의미상 진짜 주어** (동사 뒤에 위치)
     - 뒤에 또 다른 동사 없음 → 가드가 "목적어"로 오판하고 `<ss>` 제거
   - 결과: 화면처럼 주어 라벨이 사라짐

2. **(추가 가능성) LLM이 `there`를 주어로 태깅**
   - `there`는 형식상 자리만 채우는 허사(expletive)지 주어 아님
   - 진짜 주어는 항상 `be` 동사 **뒤** 명사구

### 해결 — 2단 방어

**파일: `supabase/functions/engine/index.ts`**

#### 1. 존재구문 예외를 가드에 추가 (핵심)
`stripObjectSubjectTags` 안에서 subject 태그를 제거하기 **직전**에 다음 체크:

```
- 현재 chunk 내용(태그 제거 후 텍스트)에서, 제거 대상 <s|ss> 직전 토큰들을 확인
- 패턴이 (^|문장경계) [there] [is/are/was/were/has been/have been/...] 
  바로 뒤에 오는 첫 번째 <s|ss>이면 → 제거 금지(존재구문의 진짜 주어)
- "there" 판별: 대소문자 무시, 단어 경계 기준
- be동사 변형 목록: is, are, was, were, isn't, aren't, wasn't, weren't,
  's, 're, has been, have been, had been, will be, may be, might be, can be,
  exists, exist, existed, remains, remain, remained, lies, lie, lay, comes, came
  (existential 패턴 모두 포함)
```

#### 2. 메인 프롬프트에 존재구문 명시 규칙 추가
"NEVER tag these as <s>" 섹션에 **규칙 #10** 추가:
```
10. The expletive "there" in existential sentences is NEVER the subject.
    The REAL subject is the noun phrase AFTER the be-verb (or existential verb).
    
    - WRONG:   <s>There</s> <v>is</v> so little variation amongst us
    - WRONG:   There <v>is</v> so little variation amongst us  (subject missing)
    - CORRECT: There <v>is</v> <s>so little variation</s> amongst us
    
    Same rule for: there are / there was / there were / there exists / there remains / there comes ...
    The post-verbal NP gets <s> (or <ss> if the existential clause is itself subordinate).
```

#### 3. Subject verifier 프롬프트에도 동일 규칙 추가
verifier가 존재구문을 검증할 때 빠뜨리지 않도록 동일 예시 명시.

### 변경하지 않는 것
- `<cN>` 청크 구조, 동사 태깅 로직, 한국어 번역
- 다른 R1/R2 가드 로직 (목적어-관계절 보호는 유지)
- UI / PDF (LLM 결과만 정확해지면 자동 반영)

### 검증 포인트
1. `and there is so little variation amongst us` → `there <v>is</v> <s>so little variation</s>`
2. `There are many problems` → 주어 = `many problems`
3. `There exists a solution` → 주어 = `a solution`
4. **회귀 방지**:
   - `He gave her <s>...</s>` 같은 일반 SVO에서 가드는 여전히 동작 (목적어 제거)
   - `interpret the messages they receive` 패턴 (직전 수정한 R2)도 그대로 동작
   - 종속절 안 존재구문(`...because there is no time`)도 `<vs>is</vs> <ss>no time</ss>` 유지
5. 콘솔 로그: `Existential there: preserved subject` 형태로 추적 가능

### 한계 (솔직)
- LLM이 처음부터 `there is` 뒤 NP에 태그를 안 달면 가드는 도와줄 수 없음 → 프롬프트 강화로 1차 방어
- 가드는 LLM이 정확히 태깅했는데도 잘못 떼는 케이스를 막는 안전망 역할

