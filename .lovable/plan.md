

# 핀 UI 롤백 + 고정 패턴 관리에서 추가한 태그 연동

## 요약

1. **SyntaxNotesSection.tsx의 핀 드롭다운에서 textarea 제거** — 이전처럼 태그 select + 확인 + X만 남기고, 아래 내용 편집 textarea를 삭제. 노트 내용이 그대로 `pinned_content`로 저장됨.

2. **고정 패턴 관리에서 추가한 커스텀 태그가 핀 드롭다운의 select에도 나타나도록** — 사용자가 PinnedPatternsManager에서 새 패턴을 추가하면, 그 태그가 SyntaxNotesSection의 태그 select 옵션에도 동적으로 반영.

## 변경 파일

### `src/components/SyntaxNotesSection.tsx`
- `pinContent` state 및 관련 textarea UI 제거
- `handlePinNote`에서 `pinContent` 대신 `note.content`를 직접 사용
- 고정 패턴 테이블에서 기존 태그 목록을 fetch하여 TAG_OPTIONS + 커스텀 태그를 합쳐 select에 표시
- PinnedPatternsManager가 닫힐 때 태그 목록을 다시 로드

### `src/components/PinnedPatternsManager.tsx`
- 변경 없음 (수정 기능은 이미 구현됨, 유지)

