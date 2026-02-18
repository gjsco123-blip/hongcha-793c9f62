

## passesTagFilter 완전 제거

### 문제
`passesTagFilter` 함수가 AI 응답을 키워드 매칭으로 사후 검증하는데, AI 표현이 매번 달라서 거의 모든 결과가 필터에 걸려 삭제됨. 이것이 드래그 구문분석이 항상 실패하는 원인.

### 해결
`passesTagFilter` 사후 필터링을 완전히 제거. 프롬프트에서 이미 "허용 태그에 해당하는 포인트만 작성하라"고 지시하고 있으므로 AI 출력을 신뢰.

### 수정 파일
**supabase/functions/grammar/index.ts**

1. 힌트 모드에서 `passesTagFilter` 호출 부분 삭제:
```typescript
// 삭제할 코드:
if (!useFreestyle) {
  points = points.filter((p) => passesTagFilter(p, tags));
}
```

2. `passesTagFilter` 함수 자체와 내부 `allow` 객체도 사용처가 없어지므로 함께 삭제하여 코드 정리.

### 기대 효과
- 어떤 힌트를 입력하든 AI가 생성한 구문분석이 그대로 표시됨
- 프롬프트 지시만으로 태그 범위를 제어 (더 안정적이고 유연함)

