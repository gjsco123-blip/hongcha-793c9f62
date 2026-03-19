
판단:
- 네, 이 문맥의 `convincing`은 `test`를 수식하는 형용사(분사형 형용사)로 보는 게 맞음.
- 따라서 여기서는 `convince`로 원형화하는 것도, 현재처럼 `convinc`로 잘리는 것도 둘 다 부적절함.
- 객관적으로 보면 이 케이스는 “silent e 복원 실패” 이전에, “형용사까지 동사처럼 어간화(stemming)하고 있는 설계 문제”가 핵심임.

원인:
- `src/lib/synonym-sanitizer.ts`의 `normalizeWordHead()`가 단일 단어(`tokens.length === 1`)이면 품사 구분 없이 `toBaseToken()`을 호출함.
- 그래서 한국어 뜻이 `설득력 있는`처럼 형용사 의미여도 `convincing`이 강제로 동사형 정규화 경로로 들어감.
- 즉, 이전에 잡으려던 `convinc -> convince` 보정만 넣으면 이 문장에서는 여전히 오답이 됨. 이번 케이스의 정답은 `convincing` 유지임.

구현 방향:
1. `normalizeWordHead()`를 품사 추정 기반으로 분기
   - 현재처럼 `ko.endsWith("다")`이거나 이어동사 패턴이면 동사형 정규화 유지
   - 그 외 단일 단어는 무조건 `toBaseToken()`으로 보내지 않도록 변경

2. 비동사 단일 단어 전용 정규화 헬퍼 분리
   - 목적: 형용사/분사형은 보존하고, 복수명사만 최소한으로 단수화
   - 예:
     - 유지: `convincing`, `interesting`, `required`, `professional`
     - 단수화: `efforts -> effort`
   - 즉 `-ing/-ed` 제거는 비동사 단일 단어에서는 하지 않고, 복수형 `s/es` 정리만 수행

3. 기존 동사 정규화는 그대로 유지
   - `creating -> create`
   - `dated back to -> date back to`
   - `paid attention to -> pay attention to`
   - `going through -> go through`

테스트 계획:
- 추가
  - `convincing (설득력 있는)` → `convincing (설득력 있는)` 유지
  - `required (필수적인)` 같은 분사형 형용사도 유지
- 회귀 방지
  - `creating (만들다)` → `create`
  - `efforts (노력)` → `effort`
  - `focus on (집중하다)` 유지
  - `dated back to` / `paid attention to` 계속 통과 확인

예상 효과:
- 형용사 문맥 오판 감소
- 동사 원형화 품질은 유지
- 명사 단수화 기능도 유지
- `convincing` 같은 반복 오류의 재발 가능성 크게 감소
