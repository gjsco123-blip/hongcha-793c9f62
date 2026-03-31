
# 8/8까지 갔는데 row가 사라지는 문제 — 원인과 수정 방향

## 결론
이건 엔진이 8문장 중 6문장만 분석해서가 아닙니다.  
`handleAnalyze`는 실제로 마지막 배치까지 기다리고 있고, 그래서 진행률도 `8/8`까지 갑니다.

진짜 원인은 **분석 도중 중간 결과가 자동저장되고, 그 저장본이 다시 현재 화면을 덮어쓰는 race condition** 입니다.

## 왜 이런 일이 생기나
### 1) 분석은 3개씩 배치로 나뉘어 화면에 쌓임
`src/pages/Index.tsx`
- `CONCURRENCY = 3`
- 배치 1 끝나면 3개 row 저장
- 배치 2 끝나면 6개 row 저장
- 배치 3 끝나면 8개 row 저장

### 2) 그런데 auto-save가 “분석 중간 상태”도 저장 가능함
현재 auto-save는:
- `loading` 자체를 막는 조건으로 안 쓰고
- 초기 분석 배치 결과에는 `generatingSyntax / generatingHongT / regenerating` 플래그도 없음

즉, **6개까지만 나온 상태도 정상 상태로 오인**해서 2초 뒤 저장할 수 있습니다.

### 3) 최근 수정 때문에 이 저장본이 즉시 화면에 다시 반영됨
최근에 바뀐 구조:
- `useCategories.updatePassage()`가 저장 후 local `passages` state도 즉시 갱신
- `Index`는 `categories.selectedPassage` 변경 시 다시 hydrate

그래서 예전엔 “중간 저장이 돼도 현재 메모리 화면은 계속 유지”되던 게,
지금은 **DB에 6개가 저장되면 그 6개짜리 snapshot이 현재 화면으로 다시 들어와서 row가 사라져 보이는 상태**가 됩니다.

즉, “갑자기” 심해진 이유는:
```text
기존부터 있던 중간 auto-save 가능성
+ 최근 same-passage rehydrate 구조
= 분석 완료 직후/홍T 직전에 row 누락이 눈에 보이게 됨
```

## 왜 다시 분석하면 제대로 되나
두 번째 시도에서는
- 응답 타이밍이 달라지거나
- 마지막 배치까지 간 뒤 저장이 덮어써져서
우연히 완성본이 남는 경우가 생깁니다.

즉, 지금은 **정상 동작이 아니라 타이밍 운**에 의존하는 상태입니다.

## 이 문제에서 중요한 판단
### 원인이 아닌 것
- 엔진 자체가 8개 중 일부만 반환하는 문제
- 홍T가 분석을 강제로 끊는 문제
- 단순 렌더링 누락 문제

### 실제 원인
- **분석 파이프라인 중간 상태 auto-save**
- **같은 passage에 대한 즉시 rehydrate**
- **debounce callback이 최신 상태가 아니라 당시 closure 값을 보는 구조**

## 수정 방향
### 1) 분석/홍T 전체 파이프라인 동안 auto-save 완전 차단
`src/pages/Index.tsx`
- `handleAnalyze` 시작 시 저장 타이머 즉시 clear
- `loading` 또는 별도 `analysisPipelineActiveRef`를 기준으로 auto-save 금지
- `handleRetryFailed`도 동일하게 묶기

핵심은:
```text
문장 분석 시작 ~ 홍T 자동생성 끝 ~ 최종 강제저장 완료
이 구간에는 debounce save가 절대 끼어들면 안 됨
```

### 2) auto-save 콜백이 stale closure를 보지 않게 변경
지금 timeout 내부는 과거 `results`를 보고 판단할 수 있습니다.  
그래서 다음 값들을 ref 기반으로 읽도록 바꾸는 게 안전합니다.

- `resultsRef.current`
- `loadingRef.current` 또는 `analysisPipelineActiveRef.current`
- 필요하면 `passageRef`, `pdfTitleRef`, `presetRef`, `syntaxCompletedRef`

이렇게 해야
- “2초 전에 잡힌 6개 결과”
- “지금은 이미 8개인데 예전 상태 저장”
같은 일이 재발하지 않습니다.

### 3) 같은 passage 저장 후 즉시 전체 hydrate하는 구조 분리
현재는 `selectedPassage` 객체가 바뀌면 같은 passage라도 전체 state를 다시 로드합니다.  
이걸 다음처럼 분리하는 게 맞습니다.

- **passage ID가 바뀔 때만** 전체 hydrate
- 같은 passage의 저장 결과가 돌아온 경우에는
  - `baseResultsJsonRef`만 최신화
  - 현재 편집 중인 `results/passage/pdfTitle`는 덮어쓰지 않음
- 특히 분석/홍T 중에는 절대 rehydrate 금지

이게 이번 문제의 “화면에서 row가 사라지는” 직접 원인을 막습니다.

## 다른 기능에 미치는 영향
### 좋은 영향
- 8문장은 항상 8문장 다 보인 뒤 홍T로 넘어감
- “다시 분석하기”를 눌러야 맞는 상태가 되는 현상 제거
- 저장/복원 안정성 증가
- 이후 Preview/완료 토글 쪽도 덜 흔들림

### 주의할 점
- auto-save가 분석 중에는 잠깐 멈춤
- 하지만 이건 오히려 맞는 동작이고, 마지막 강제 저장이 있으므로 데이터 유실 위험은 더 줄어듦

### 영향 적은 영역
- 엔진 프롬프트/AI 품질
- PDF 생성
- 학교/지문 선택 UI
- batch PDF 기능

## 구현 플랜
1. `Index.tsx`에 분석 파이프라인 전용 active ref/state 추가
2. `handleAnalyze`/`handleRetryFailed` 시작 시 기존 save timer clear
3. auto-save에서 `loading/analysis active`일 때 스케줄 자체 금지
4. timeout 내부도 ref 기반 최신값만 읽도록 변경
5. 같은 passage 업데이트 시 전체 hydrate하지 않고, passage 전환시에만 hydrate하도록 effect 분리
6. 최종 저장은 홍T 완료 후 1회만 확정 저장

## 검증 포인트
```text
A. 8문장 입력 → 응답이 느린 문장 섞여도 8개 row 전부 먼저 렌더
B. 8/8 이후에만 홍T 시작
C. 중간에 3개/6개만 남는 현상 없음
D. 다시 나갔다 들어와도 8개 유지
E. 실패 재시도/개별 재분석/완료 토글 저장 동작 유지
```

## 한 줄 요약
이번 건은 “분석이 덜 된 것”이 아니라, **분석 중간 snapshot이 저장되고 최근 hydrate 구조가 그 snapshot을 다시 현재 화면에 덮어써서 생기는 문제**입니다.  
해결은 **분석~홍T 전체 구간의 저장 차단 + stale timeout 제거 + same-passage rehydrate 분리**가 맞습니다.
