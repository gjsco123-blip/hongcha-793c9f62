
# 홍T AI 수정 채팅: Sheet → Dialog(중앙 모달)로 변경

## 변경 내용

### `src/components/HongTChat.tsx`
- `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` → `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`로 교체
- 구문분석 AI 채팅(SyntaxChat)과 동일하게 중앙 모달 형태로 표시
- 클래스: `w-[90vw] max-w-lg` + `max-h-[80vh]` + flex column 레이아웃
- 내부 구조(메시지 목록, 입력창, 수정안 적용 등)는 그대로 유지

### 변경 범위
- `HongTChat.tsx` 1개 파일만 수정
- import 교체 + 컨테이너 태그 교체만으로 완료
- 데이터 로직, 콜백, 기존 기능 영향 없음
