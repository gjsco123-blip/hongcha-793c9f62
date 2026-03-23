
# 위첨자 오배치가 반복되는 이유와 수정 계획

## 원인 진단

이건 AI가 같은 실수를 반복한다기보다, 현재 프론트의 위첨자 배치 로직이 `targetText`를 찾은 뒤에도 앵커를 다시 옮기기 때문에 생기는 문제임.

### 1) 첫 번째 사례: `we do`를 드래그했는데 다른 곳에 붙는 이유
- 수동 선택 구문은 `src/pages/Index.tsx`에서 `targetText: selectedText`로 그대로 저장됨.
- 즉 선택 자체(`we do`)는 제대로 들어감.
- 그런데 `src/lib/syntax-superscript.tsx`의 `computeSuperscriptPositions → chooseAnchorOffset`에서,
  찾은 span 안에 고정하지 않고 `note.content`에 들어있는 영어 힌트로 다시 앵커를 고름.
- 이 과정에서 `hintedNearby / hintedGlobal`이 span 바깥 단어까지 참고해서 `work` 같은 엉뚱한 단어로 이동할 수 있음.

### 2) 두 번째 사례: `the need`를 드래그했는데 `need`에 붙는 이유
- span 자체는 `the need`로 맞게 잡혀도,
- 같은 함수가 “의미 있는 영어 단어”를 우선시해서 관사 `the`보다 `need`를 더 강하게 선택함.
- 그래서 “선택 시작점”이 아니라 “span 안의 핵심어”에 붙어버림.

### 3) 왜 전에 고쳤는데 또 반복되나
- 최근 수정은 `tokensInSpan.length === 1`일 때만 직접 선택 단어에 고정하는 예외 처리였음.
- 즉 `it` 같은 한 단어 선택은 보완됐지만,
- `we do`, `the need` 같은 2단어 이상 수동 선택은 여전히 기존 휴리스틱을 타서 같은 문제가 계속 남아 있음.

### 4) 백엔드도 간접적으로 영향 있음
- `supabase/functions/grammar/index.ts`에서 수동 선택이 3단어 미만이면 `textToAnalyze = full`로 전체 문장을 다시 분석함.
- 그래서 모델 설명문에 선택 바깥 단어가 더 많이 섞이고,
- 그 단어들이 위첨자 앵커 재선정 로직에 잘못 활용될 가능성이 커짐.

## 구현 계획

### 1. 수동 선택 노트와 자동 생성 노트를 구분
- `SyntaxNote`에 선택 출처 메타데이터 추가
  - 예: `anchorMode: "selection-start" | "heuristic"`
- 드래그해서 만든 수동 구문분석은 항상 `selection-start`로 저장

### 2. 수동 선택은 “선택 시작 단어”에 강제 고정
- `src/lib/syntax-superscript.tsx`
- `anchorMode === "selection-start"`이면:
  - span을 찾은 뒤 `chooseAnchorOffset` 휴리스틱을 거의 타지 않음
  - 1단어 선택: 그 단어 시작점
  - 2단어 이상 선택: 첫 단어 시작점
- 즉 `we do`는 무조건 `we`, `the need`는 무조건 `the`에 붙게 변경

### 3. 휴리스틱이 span 밖으로 나가지 못하게 안전장치 추가
- 특히 `hintedNearby / hintedGlobal` 계열이 manual note에서는 절대 span 밖 앵커를 반환하지 못하게 제한
- 자동 생성 노트에서도 일반 fallback은 span 내부 우선으로 정리

### 4. 짧은 수동 선택의 백엔드 프롬프트 보정
- `supabase/functions/grammar/index.ts`
- 3단어 미만 선택이라고 해서 `분석 대상`을 전체 문장으로 바꾸지 않도록 수정
- 전체 문장은 컨텍스트로만 주고,
- 실제 대상은 항상 사용자가 드래그한 구문으로 유지

### 5. 회귀 테스트 추가
- `src/lib/syntax-superscript.test.ts`
- 최소 3개 케이스 추가
  1. `we do` 선택 시 `we`에 고정
  2. `the need` 선택 시 `the`에 고정
  3. 단일 단어 선택(`it`) 기존 동작 유지
- 필요하면 PDF 경로에서도 같은 로직을 쓰므로 동일 기대값 검증

## 수정 파일 범위

1. `src/pages/Index.tsx`
2. `src/lib/syntax-superscript.tsx`
3. `src/lib/syntax-superscript.test.ts`
4. `supabase/functions/grammar/index.ts`

## 기대 효과

- 수동 드래그한 구문분석 번호는 사용자가 집은 “첫 단어”에 안정적으로 붙음
- 같은 문장을 다시 생성해도 `note.content` 문구 때문에 번호가 딴 데로 튀는 현상 감소
- 지금처럼 “한 번 고치면 다른 다단어 선택에서 또 틀리는” 패턴을 구조적으로 끊을 수 있음

## 핵심 기술 포인트

지금 버그의 본질은 “span 탐색 실패”보다 “span 탐색 후 앵커 재이동”에 있음.  
따라서 이번 수정은 AI 프롬프트만 더 세게 하는 방식보다, 수동 선택과 자동 선택의 앵커 정책을 분리하는 쪽이 맞음.
