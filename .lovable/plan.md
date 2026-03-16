

# 고정 패턴 관리 — Sheet → Dialog 전환

SyntaxChat과 동일한 문제입니다. `Sheet`(오른쪽 슬라이드 패널)가 798px 뷰포트에서 메인 콘텐츠와 어색하게 겹침.

## 변경 내용

### `src/components/PinnedPatternsManager.tsx`
- `Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` → `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle`로 교체
- 레이아웃: `w-[90vw] max-w-lg h-[70vh]` — SyntaxChat 모달과 동일한 사이즈
- `p-0 gap-0 flex flex-col` 유지하여 내부 스크롤 + 하단 추가 버튼 고정
- `Pin` 아이콘 제거 (미니멀 디자인 원칙)
- import 변경: `sheet` → `dialog`

