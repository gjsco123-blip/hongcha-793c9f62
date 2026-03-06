

## 문제

Preview 페이지의 뒤로가기 버튼이 `navigate(-1)`을 사용하고 있어서:
1. 새로고침 후에는 히스토리가 없어 버튼이 아무 동작도 안 함
2. 정상 작동하더라도 카테고리 선택 화면으로 돌아가는 경우가 있음

사용자가 원하는 동작: Preview → 뒤로가기 → **구문분석 에디터 화면** (지문이 로드된 상태)

## 해결

**`src/pages/Preview.tsx`** — 1줄 수정

`navigate(-1)` → `navigate("/")`로 변경.

`selectedSchoolId`와 `selectedPassageId`가 이미 sessionStorage에 저장되어 있으므로, `/`로 이동하면 `useCategories` 훅이 자동으로 이전 선택 상태를 복원하여 구문분석 에디터 화면이 바로 표시됩니다 (`selectedPassageId`가 있으면 `CategoryFullScreen`을 건너뛰고 에디터를 렌더링).

