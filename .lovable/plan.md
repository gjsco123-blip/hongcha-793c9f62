

## 목적어가 주어로 잘못 태깅되는 문제 — 결정적 후처리 가드 추가

### 사고 분석

스크린샷 문장: *"How people interpret **the messages** they receive and **the situations** they encounter becomes their subjective reality..."*

올바른 구조:
- `the messages`, `the situations` = `interpret`의 **목적어 (NP)** → **태그 없음**
- `they receive`, `they encounter` = 그 목적어를 수식하는 **목적격 관계절** (관계대명사 생략) → 관계절 안의 `they`만 `<ss>`, `receive/encounter`만 `<vs>`

LLM이 잘못 태깅한 결과 (현 화면):
- `<ss>the messages</ss>` ❌, `<ss>the situations</ss>` ❌

### 근본 원인
1. **프롬프트 충돌**: "동사 뒤 NP는 목적어(<s> 금지)" 규칙(254줄)과 "관계절 선행사를 <s>로 태깅"(223줄, 311줄) 규칙이 **목적격 관계절**(예: `verb + NP + [that/who/which 생략] + S + V`) 케이스에서 충돌. LLM이 후자를 우선 적용.
2. **검증 통과**: subject verification pass도 같은 LLM 기반이라 같은 실수 반복(LLM 일관성 편향).
3. **결정적 가드 부재**: "`<v>` 직후 첫 명사구는 절대 `<s>`/`<ss>` 금지" 같은 코드 레벨 룰이 없음.

### 해결 — 3중 방어
**파일: `supabase/functions/engine/index.ts`**

#### 1. 결정적 후처리 함수 `stripObjectSubjectTags()` 추가 (핵심)
정규식·토큰 기반으로 LLM 결과에서 명백히 잘못된 `<s>/<ss>` 제거. 검증 패스 **다음**에 마지막으로 실행 (LLM이 다시 망쳐도 못 빠져나감).

규칙:
- **R1**: `<v>...</v>` 또는 `<vs>...</vs>` 직후, 같은 절(같은 `<cN>` 안 OR 인접 `<cN>`)에서 처음 등장하는 `<s>...</s>` 또는 `<ss>...</ss>`가 **다른 동사 태그를 가운데 두지 않고** 바로 이어지면 → 그 NP는 목적어이므로 `<s>/<ss>` 태그만 벗기기 (텍스트는 보존).
  - 단, 그 NP 직후에 **새로운 동사 태그**(`<v>`/`<vs>`)가 같은 절 안에 있으면 → 진짜 다음 절의 주어일 수 있으므로 건너뜀.
- **R2** (관계절 특화): 패턴 `<v|vs>X</v|vs> <s|ss>NP</s|ss> <s|ss>Y</s|ss> <v|vs>Z</v|vs>` 감지 — `NP`와 `Y` 사이에 동사가 없고 `Y` 뒤에 동사가 오면 → `NP`는 **선행사+목적어**, `Y`는 **관계절 주어**. → `NP`의 `<s|ss>` 제거 (목적어), `Y`의 `<ss>`는 유지.
  - 이 패턴이 정확히 스크린샷의 `interpret <ss>the messages</ss> <ss>they</ss> <vs>receive</vs>` 케이스를 커버.
- **R3**: 같은 `<cN>` 청크 안에 `<s>`/`<ss>`가 2개 이상이고 사이에 동사가 없으면 → 첫 번째가 목적어로 추정되므로 제거 (보수적: 두 번째에 동사가 따라올 때만).

안전장치:
- 텍스트 내용·`<cN>` 구조·동사 태그 개수 변경 없음을 검증한 뒤 적용.
- 변화량이 비정상(>50% 주어 제거)이면 폐기.

#### 2. 메인 프롬프트 강화 (294줄 근처)
"NEVER tag these as <s>" 섹션에 **명시적 신규 규칙** 추가:
```
9. Antecedent of an OBJECT relative clause when the antecedent ITSELF is the OBJECT
   of an outer verb. The antecedent stays UNTAGGED; only the inner subject of the
   relative clause gets <ss>.
   - WRONG:   <s>How</s> <s>people</s> <v>interpret</v> <s>the messages</s> <s>they</s> <v>receive</v>
   - CORRECT: How <ss>people</ss> <vs>interpret</vs> the messages <ss>they</ss> <vs>receive</vs>
   - 이유: "the messages"는 interpret의 목적어이자 동시에 관계절(생략된 that/which)의 선행사.
     목적어이기 때문에 <s>/<ss>를 받지 않는다.
```

#### 3. Subject verification 프롬프트에도 동일 규칙 추가
verifier가 "선행사니까 무조건 `<s>`" 라는 잘못된 학습을 깨도록.

### 변경 안 하는 것
- `<cN>` 청크 구조, 동사 태그 로직, 한국어 번역
- UI / PDF (LLM 결과만 정확해지면 자동 반영)
- 기존 verb verification pass

### 검증 포인트
1. 스크린샷 문장 재분석 → `the messages`, `the situations`에 밑줄/라벨 없어야 함
2. 관계절 안의 `they receive`, `they encounter`는 그대로 `s'/v'`로 표시
3. 단순 관계절 (`the book that I read`) → `<s>the book</s> that <ss>I</ss> <vs>read</vs>` 정상 유지
4. 주어-관계절 (`the people who are taking part`) → 선행사가 진짜 주어면 `<s>` 유지
5. 일반 SVO 문장 (`He gave her a book`) 영향 없음
6. 콘솔 로그에 `Object-as-subject strip: removed N tags` 형태로 가드 작동 여부 추적 가능

### 한계
- 매우 드물게 보수적 규칙이 정상 케이스를 건드릴 수 있음 → 변화량 임계값과 텍스트 무결성 체크로 폐기
- 100% 보장 아니지만 LLM 단독 대비 신뢰도 대폭 상승

