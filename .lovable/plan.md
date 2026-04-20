

## 주어 밑줄 오류 진단 및 수정 플랜

### 내가 지금 보는 결론
**Do I know what the issue is? Yes.**

지금 문제는 렌더링이 아니라 **엔진의 `<s>` 태깅 품질 문제**일 가능성이 가장 큼.

근거:
- 업로드된 화면처럼 밑줄이 **목적어/서술부 쪽까지** 들어가 있음
- `ChunkEditor`, `ResultDisplay`, `PdfDocument`는 모두 **`isSubject`가 있으면 그대로 밑줄만 그림**
- `parseTaggedSegments`도 `<s>`를 기계적으로 파싱만 함
- 즉, **잘못된 `<s>`가 저장되면 UI는 그 실수를 충실히 보여주는 구조**

추가로 현재 엔진에는:
- `<s>` 규칙은 들어갔지만
- **“목적어는 절대 태그하지 마라”**는 부정 규칙이 약하고
- **subject 전용 verification pass가 없음**
- 오히려 verb verification은 `"<s>를 그대로 보존하라"`고 되어 있어서, **한 번 잘못 찍힌 `<s>`를 고정해버릴 수 있음**

### 실제 원인
핵심 원인은 두 가지로 보임.

1. **엔진 프롬프트가 주어 정의는 했지만, 목적어/보어/전치사 목적어/부정사 목적어 배제 규칙이 충분히 강하지 않음**
   - 특히 “동사 뒤 명사구”를 무조건 주어처럼 오인할 여지가 있음
   - 관계절/to부정사/분사구가 붙은 구간도 과하게 `<s>`로 감쌀 수 있음

2. **생성 후 검증 단계가 없음**
   - 현재는 `<v>`만 검증
   - `<s>`는 틀려도 그대로 통과
   - 그래서 잘못된 subject underline이 DB `results_json`에 저장되고 계속 재사용됨

### 수정 방향
#### 1) `supabase/functions/engine/index.ts` 보강
주어 규칙을 더 강하게 바꿔야 함.

추가할 핵심 규칙:
- `<s>`는 **각 finite clause의 문법적 주어 1개만**
- **절대 태그 금지**
  - direct object
  - indirect object
  - object complement
  - object of preposition
  - noun inside infinitive phrase
  - noun inside participial phrase
- **동사 뒤 명사구는 기본적으로 목적어로 의심**하고, `there/here + be` 같은 예외일 때만 주어로 인정
- `<s>` 내부에는
  - finite verb
  - to부정사 핵심부
  - 전치사구 후치수식
  - 관계절
  이 들어가면 안 됨

부정 예시를 명시:
- `The policy allows citizens to retain freedom`
  - `<s>The policy</s> <v>allows</v> citizens...`
  - `citizens`는 목적어
- `Technology has shifted the balance of power`
  - `<s>Technology</s> <v>has shifted</v> the balance of power`
  - `the balance of power`는 목적어
- `The democratization of X will not solve the problem`
  - `<s>The democratization</s> ...`
  - `the problem`은 목적어

#### 2) subject verification pass 추가
`<v>` 검증처럼 **`<s>` 전용 검증 단계**를 추가하는 게 핵심.

역할:
- `<cN>` 구조와 원문 텍스트는 절대 안 바꾸고
- `<s>`만 수정
- `<v>`는 그대로 보존
- 목적어/보어에 붙은 `<s>` 제거
- clause별 진짜 subject만 남김

권장 순서:
1. 초기 분석
2. **subject verify**
3. verb verify

이 순서가 좋은 이유:
- 잘못된 `<s>`가 먼저 정리된 뒤
- verb verify가 그 구조를 안정적으로 유지할 수 있음

#### 3) 기존 저장 데이터 처리 주의
엔진을 고쳐도 **기존 `results_json`의 잘못된 `<s>`는 그대로 남아 있음**.

그래서 수정 후에는:
- 현재 보고 있는 지문은 **새로 분석** 필요
- 필요하면 나중에 선택 지문 재분석 버튼/일괄 재분석도 고려 가능

### 코드 변경 범위
- **주요 수정 파일**
  - `supabase/functions/engine/index.ts`

- **가능하면 최소 보조 수정**
  - 없음으로 가는 게 가장 안전
  - 렌더러(`ChunkEditor`, `ResultDisplay`, `PdfDocument`)는 지금 잘못이 아님

### 왜 렌더링 쪽을 먼저 안 건드리나
렌더링에서 억지 필터를 넣으면:
- 진짜 주어도 숨길 수 있고
- 종속절 주어 / there-here 예외 / 가주어 It 처리까지 깨질 수 있음

즉, 이건 **UI가 아니라 문법 판정 엔진 문제**라서
**상류(엔진)에서 고치는 게 맞음**.

### 검증 기준
수정 후 아래가 반드시 맞아야 함.

- `The policy allows citizens to retain freedom`
  - `<s>The policy</s>`만 밑줄
  - `citizens`, `freedom` 밑줄 금지

- `Technology has shifted the balance of power`
  - `<s>Technology</s>`만 밑줄
  - `the balance of power` 밑줄 금지

- `The democratization of technology will not solve the problem`
  - `<s>The democratization</s>`만 밑줄
  - `the problem` 밑줄 금지

- `There are many students in the room`
  - `<s>many students</s>`만 밑줄

- `Because the rain stopped, we went out`
  - `<s>the rain</s>`, `<s>we</s>` 둘 다 밑줄

### 최종 실행 플랜
1. `engine/index.ts`의 subject 규칙을 **“무엇을 태그할지”보다 “무엇을 절대 태그하면 안 되는지” 중심으로 재작성**
2. 목적어/보어 오판 방지 **negative few-shot** 추가
3. **subject verification pass** 추가
4. 현재 지문 새 분석 기준으로 웹/PDF 동작 재검증
5. 기존 저장 데이터는 재분석 필요 여부까지 정리

