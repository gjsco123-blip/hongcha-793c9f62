

# 지문 입력 자동완성 + 순서 변경 기능

## 1. 이전 제목 자동완성 (autocomplete)

**`CategorySelector.tsx`** 지문 추가 입력 필드에서:
- 현재 학교의 기존 지문 이름들을 기반으로 입력 중 필터링된 제안 목록 표시
- 제안 클릭 시 입력 필드에 자동 채움
- 클릭 또는 키보드(↑↓ Enter)로 선택 가능
- 순수 프론트엔드 로직 — `passages` 배열에서 `name` 필터링

## 2. 지문 순서 변경 (drag reorder)

### DB 변경
- `passages` 테이블에 `sort_order integer default 0` 컬럼 추가 (migration)
- 기존 데이터: `created_at` 순서 기준으로 sort_order 초기값 설정

### 백엔드 로직
- `fetchPassages`: `order("sort_order")` 로 정렬
- `addPassage`: 새 지문의 `sort_order`를 현재 최대값 + 1로 설정
- `reorderPassages(passageIds: string[])`: 순서 배열을 받아 각 passage의 sort_order를 일괄 업데이트 → `useCategories` 훅에 추가

### UI (CategorySelector.tsx)
- 각 지문 항목 왼쪽에 드래그 핸들 아이콘 (`GripVertical`) 추가
- HTML Drag & Drop API로 구현 (라이브러리 추가 없음)
- `dragStart` → `dragOver` → `drop` 이벤트로 순서 변경
- drop 시 로컬 상태 즉시 업데이트 + DB 저장

## 수정 파일
1. `supabase/migrations/` — `sort_order` 컬럼 추가
2. `src/hooks/useCategories.ts` — 정렬 기준 변경, reorder 함수 추가
3. `src/components/CategorySelector.tsx` — 자동완성 UI + 드래그 재정렬 UI

