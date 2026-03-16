
문제 원인은 거의 확실합니다: 구문분석의 “생성 중” 상태가 실제 작업 상태가 아니라 저장된 데이터에 같이 남아버리고 있습니다.

## 왜 이런 일이 생기나
현재 구조를 보면:

- `src/pages/Index.tsx`에서 `handleGenerateSyntax()` 시작 시 `generatingSyntax: true`로 바꿈
- 자동저장에서 `results` 전체를 그대로 `results_json`에 저장
- 다시 열 때 `parsePassageStore()`로 불러온 결과를 거의 그대로 `setResults(loaded)` 함
- 이때 저장돼 있던 `generatingSyntax: true`가 그대로 복원되면, 실제 요청은 이미 끝났거나 사라졌는데 UI는 계속 “구문분석 생성 중...”으로 보임

즉, 일시적인 UI 상태를 영구 저장해서 생기는 문제입니다.

## 가장 가능성 높은 시나리오
이 중 하나였을 가능성이 큽니다.

1. 구문분석 생성 버튼을 누른 직후 자동저장이 먼저 실행됨
2. 그 상태로 페이지 이동/새로고침/로그인 화면 이동이 발생함
3. 다음 진입 때 DB에 저장된 `generatingSyntax: true`를 다시 읽음
4. 실제 요청은 더 이상 없어서 false로 돌아올 기회가 없음

## 해결책
### 1) 저장할 때 transient 상태 제외
`results_json`에 아래 값들은 저장하지 않도록 정리합니다.

- `generatingSyntax`
- `generatingHongT`
- `regenerating`

즉 저장용 payload를 따로 만들고, UI 전용 상태는 DB에 안 넣는 방식으로 바꿉니다.

### 2) 불러올 때도 강제 초기화
기존에 이미 잘못 저장된 데이터가 있을 수 있으니, 로드 시에도 아래를 강제로 false 처리합니다.

- `generatingSyntax: false`
- `generatingHongT: false`
- `regenerating: false`

이렇게 하면 이미 꼬인 기존 데이터도 바로 풀립니다.

### 3) 추천 보완책
구문분석 생성이 실패하거나 중간에 끊겨도 영원히 잠기지 않게 안전장치를 추가하는 걸 추천합니다.

- 요청 시작 시점 기록
- 일정 시간 이상 지나면 생성 중 상태 자동 해제
- 또는 컴포넌트 재진입 시 in-flight 요청이 없으면 false로 리셋

## 변경 파일
### `src/pages/Index.tsx`
핵심 수정 파일입니다.

- 저장 직전 `results`를 sanitize해서 transient 필드 제거
- 불러올 때 `loaded` 매핑에서 transient 필드들을 false로 초기화

예상 방향:
- `serializeResultsForStore(results)` 같은 헬퍼 추가
- `setResults(loaded)` 시 `...r` 뒤에 `generatingSyntax: false`, `generatingHongT: false`, `regenerating: false`

### 선택적 정리
#### `src/lib/passage-store.ts`
원하면 여기로 저장/복원 정리 로직을 옮겨서 공통화할 수 있습니다.
다만 이번 버그는 `Index.tsx`만 고쳐도 해결 가능합니다.

## 추천 방안
추천은 “이중 방어”입니다.

- 저장 시 transient 상태 제거
- 로드 시 transient 상태 강제 초기화

이렇게 해야
- 새 데이터도 안 꼬이고
- 기존 꼬인 데이터도 바로 복구됩니다.

## 기대 결과
수정 후에는:
- 구문분석 생성 중 오버레이가 영구 고정되지 않음
- 새로고침/재로그인/페이지 이동 후에도 정상 상태로 복구됨
- 같은 패턴의 `홍T 생성 중`, `재생성 중` 고착 문제도 함께 예방 가능

## 기술 메모
현재 버그는 AI 함수 자체 문제라기보다 상태 영속화 설계 문제에 가깝습니다.  
즉 “생성 실패”보다는 “생성 중이라는 UI 플래그를 저장한 것”이 핵심 원인입니다.
