

# 분석하기 → 홍T 자동 생성 통합

## 변경 요약
"분석하기" 버튼 클릭 시 구문분석 완료 후 홍T를 순차 생성. "홍T 일괄 생성" 버튼 제거. 개별 "자동 생성" 버튼은 유지.

## 변경 파일: `src/pages/Index.tsx`

### 1. `handleAnalyze` 함수 수정 (line 346~397)
- 기존 구문분석 루프 완료 후, `setLoading(false)` 전에 홍T 순차 생성 로직 추가
- 기존 `generateAllHongT`의 로직을 인라인으로 재사용:
  - 분석 성공한 문장 중 `hongTNotes`가 비어있는 것만 필터
  - 순차적으로 `generateHongT()` 호출 (500ms 딜레이)
  - 진행률 표시: `분석 완료! 홍T 생성 중... (3/7)` 형태로 버튼 텍스트 변경
- 홍T 생성 중에도 `loading` 상태 유지하되, 별도 상태(`hongTPhase`)로 구분

### 2. 진행률 표시
- 새 state: `hongTPhase: { current: number; total: number } | null`
- 버튼 텍스트:
  - 구문분석 중: `분석 중... (2/5)`
  - 홍T 생성 중: `홍T 생성 중... (3/5)`
  - 완료: `분석하기`

### 3. "홍T 일괄 생성" 버튼 제거
- UI에서 해당 버튼 JSX 삭제 (line ~795-804)
- `generateAllHongT` 함수와 `batchHongTProgress` state는 제거

### 4. 유지되는 것
- 개별 HongTSection의 "자동 생성" 버튼 (재생성 용도)
- `generateHongT` 함수 (개별 호출에 계속 사용)

