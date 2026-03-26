

# 홍T 일괄 생성 버튼 구현

## 요약
"PDF 미리보기" 버튼 옆에 **"홍T 일괄 생성"** 버튼을 추가. 클릭 시 `hongTNotes`가 비어있는 문장만 순차적으로 자동 생성.

## 변경 파일

### `src/pages/Index.tsx`

1. **일괄 생성 함수 추가** (`generateHongT` 아래):
   - `generateAllHongT` 함수 생성
   - `results`에서 `hongTNotes`가 비어있고 `hideHongT`가 아닌 문장만 필터
   - 순차 실행 (1개씩) — Rate limit 방지
   - 각 문장 생성 완료 시 즉시 UI 반영
   - 진행 상태 표시를 위한 `batchHongTProgress` state 추가 (`{ current, total } | null`)

2. **버튼 UI 추가** (약 752행, "PDF 미리보기" 버튼 옆):
   - `batchHongTProgress`가 null이면: `"홍T 일괄 생성"` 버튼 (Sparkles 아이콘)
   - 진행 중이면: `"홍T 3/7..."` 형태로 진행률 표시 + 비활성화
   - 대상 문장이 0개면 버튼 숨김 또는 비활성화

3. **에러 처리**:
   - 개별 문장 실패 시 해당 문장만 skip, 나머지 계속 진행
   - 완료 후 toast로 결과 요약 (`"홍T 생성 완료: 5/7 성공"`)

## 기술 세부사항

```text
순차 처리 흐름:
for each sentence (missing hongT) {
  → generateHongT(id, allSentences)  // 기존 함수 재사용
  → update progress state
  → 500ms delay (rate limit 방지)
}
→ toast 결과 요약
```

- 기존 `generateHongT` 함수를 그대로 호출하되, 내부에서 `generatingHongT` 상태를 개별 관리하므로 UI에 문장별 로딩 표시 자동 적용
- 일괄 생성 중 개별 "자동 생성" 버튼도 비활성화 처리

