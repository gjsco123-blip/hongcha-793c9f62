
# 저장 안 되는 것처럼 보이는 원인 분석과 수정 플랜

## 판단
원인 파악됨. 이번 문제는 “완료 버튼을 눌러야 저장되는 구조”가 아니라, **저장 후 다시 들어올 때 불러오는 기준 데이터가 stale(오래된 메모리 상태)** 인 게 핵심입니다.

## 정확한 원인
### 1) 저장은 DB로 가지만, 로컬 `passages` 목록은 갱신되지 않음
파일: `src/hooks/useCategories.ts`

- `updatePassage()`는 DB `update`만 하고 끝납니다.
- 그런데 현재 화면의 `selectedPassage`는 DB가 아니라 `passages` state 배열에서 찾습니다.
- 즉, 저장 이후에도 메모리 안의 `selectedPassage`는 **예전 값(빈 지문, 빈 results_json)** 그대로 남아 있을 수 있습니다.

### 2) Index 화면은 재진입 시 DB가 아니라 그 stale `selectedPassage`로 상태를 복원함
파일: `src/pages/Index.tsx`

- `useEffect`에서 `categories.selectedPassage`를 바로 읽어
  - `passage`
  - `pdfTitle`
  - `results`
  - `completion`
  을 복원합니다.
- 문제는 이 `selectedPassage`가 최신 DB 값이 아니라, **초기 생성 시점의 빈 row** 일 수 있다는 점입니다.

### 3) 그 다음 auto-save가 빈 상태를 다시 DB에 덮어씀
파일: `src/pages/Index.tsx`

- stale passage로 화면이 빈 상태가 되면
- `autoSave()`가 2초 뒤 실행되면서
- 빈 `passage_text`, 빈 `syntaxResults`를 다시 저장할 수 있습니다.

즉 흐름은 이렇게 됩니다:

```text
정상 저장 → 같은 세션에서 나갔다 다시 들어옴
→ stale local passage로 빈 화면 복원
→ autoSave가 그 빈 상태를 DB에 다시 저장
→ "저장이 아예 안 된 것처럼" 보임
```

## 왜 갑자기 이렇게 보였는가
최근 수정은 주로 **분석 종료 직후 강제 저장** 쪽이었고, 그 이슈는 “저장 시점” 문제였습니다.  
그런데 지금 증상은 저장 시점보다 더 깊은 문제인 **재로딩 소스의 불일치(메모리 vs DB)** 입니다.

즉:
- 최근 수정은 저장 타이밍 문제를 건드렸고
- 실제 남아 있던 구조적 문제는 **`selectedPassage` stale 상태를 신뢰하는 로딩 구조**
- 그래서 지금은 “홍T만”이 아니라 **구문분석 전체가 날아가는 것처럼** 보이는 단계까지 온 상태입니다.

## 완료 버튼과의 관계
- `완료` 버튼은 저장의 필수 조건이 아닙니다.
- 현재도 완료 토글은 별도 저장을 시도합니다.
- 하지만 **다시 들어올 때 stale 데이터로 화면을 복원하고, 그 빈 상태가 auto-save로 덮어써질 수 있어서**, 완료를 눌러도 안전하지 않습니다.

즉, 문제는:
- “완료를 눌러야 저장됨”이 아니라
- “저장 후 재진입 시 잘못된 소스로 복원되고, 그 상태가 다시 저장됨”입니다.

## 최적의 해결책
### 1) `useCategories.updatePassage()`를 단일 진실 소스로 바꾸기
파일: `src/hooks/useCategories.ts`

수정 방향:
- `update(...).select("*").single()`로 최신 row를 받아오고
- `setPassages()`로 해당 passage를 즉시 교체
- 필요하면 반환값도 updated row로 넘기기

효과:
- 같은 세션 안에서 다시 들어와도 `selectedPassage`가 최신 상태를 가리킴
- Index / Category selector / 다른 소비처 모두 동시에 안정화

### 2) Index는 복원 시 fresh row 기준으로 로드
파일: `src/pages/Index.tsx`

수정 방향:
- 현재처럼 `categories.selectedPassage`만 믿지 말고
- `selectedPassageId` 기준으로 최신 row를 직접 읽거나,
- 최소한 hook에서 갱신된 updated row를 기준으로 hydrate

권장:
- Preview 페이지처럼 “base snapshot”을 별도로 관리
- merge/save의 기준도 stale `selectedPassage.results_json` 대신 최신 base 사용

효과:
- 재진입 시 빈 화면 복원 방지
- Preview/Index가 서로 덮어쓰는 문제도 완화

### 3) passage 전환/재진입 중에는 auto-save 차단
파일: `src/pages/Index.tsx`

수정 방향:
- passage 선택이 바뀌는 순간 `dataLoadedRef`를 즉시 false로 리셋
- fresh row 로딩 완료 전까지는 저장 금지
- 필요하면 `loadingSelectedPassage` 상태를 둬서 빈 화면 대신 로딩 UI 표시

효과:
- “로딩 중 잠깐 빈 상태”가 DB에 저장되는 사고 차단

### 4) Index의 merge base도 최신화
파일: `src/pages/Index.tsx`

현재 위험:
- `mergePassageStore(categories.selectedPassage?.results_json, ...)`
- 여기 base가 stale이면 preview/completion 정보까지 유실 가능

수정 방향:
- Preview처럼 `baseResultsJson` 상태를 두고
- 저장 성공 시 그 base도 함께 최신화

효과:
- 구문분석 저장이 Preview 저장분을 지우는 문제 예방
- completion 필드 충돌 감소

## 다른 기능에 미치는 영향
### 좋은 영향
- 같은 세션에서 지문 재진입 안정화
- 구문분석/홍T/완료 토글 저장 신뢰도 상승
- Preview와 Index 간 `results_json` 충돌 감소

### 주의할 영향
- `updatePassage()`가 이제 로컬 state까지 갱신하므로, 관련 화면에서 re-render가 조금 더 자주 일어날 수 있음
- 하지만 이건 정상적인 비용이고, 현재 데이터 유실 리스크보다 훨씬 작음

### 영향 적은 영역
- 로그인/권한 구조와는 무관
- AI 함수 자체와도 무관
- PDF 생성 로직과도 직접 무관

## 구현 플랜
1. `useCategories.updatePassage()`를 최신 row 반환 + `passages` state 동기화 구조로 변경
2. `Index`의 선택 passage 로딩을 stale local object 의존 구조에서 fresh 기준 구조로 변경
3. `Index`에 `baseResultsJson` 또는 동등한 최신 merge base 도입
4. passage 전환/재진입 동안 auto-save 차단
5. 저장 후 재진입, 완료 토글 후 재진입, Preview 왕복, 같은 passage 재선택 케이스 전부 검증

## 검증 시나리오
```text
A. 새 지문 생성 → 본문 입력 → 분석하기 → 바로 나가기 → 재진입
B. 새 지문 생성 → 분석하기 → 완료 토글 → 나가기 → 재진입
C. 분석 후 Preview 갔다가 뒤로 오기
D. 같은 세션에서 목록으로 갔다가 같은 passage 다시 열기
E. 기존 지문 수정 후 재진입
```

## 이번 수정의 목표
단순히 “분석 직후 한 번 더 저장”이 아니라,
**저장/복원/병합의 기준 데이터를 모두 최신화해서 같은 유형의 오류가 다시 안 생기게 하는 것**입니다.
