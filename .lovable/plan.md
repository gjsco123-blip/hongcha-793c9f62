

# 지문 목록 고정 높이 스크롤 박스 + 드래그 자동 스크롤

## 변경 내용 (`src/components/CategorySelector.tsx`)

### 1) 지문 목록을 고정 높이 스크롤 컨테이너로 감싸기
- 387번 줄 `<div className="space-y-1">` → `<div ref={listRef} className="space-y-1 max-h-[60vh] overflow-y-auto">`
- `useRef<HTMLDivElement>` 추가

### 2) 드래그 중 자동 스크롤 로직 추가
- `onDragOver` 핸들러에서 마우스 Y 위치를 컨테이너 경계와 비교
- 상단 40px 이내 → `listRef.current.scrollTop -= 5`
- 하단 40px 이내 → `listRef.current.scrollTop += 5`
- `requestAnimationFrame` 기반으로 부드럽게 처리

### 3) 새 지문 추가 후 자동 스크롤
- `handleAddPassage` 성공 시 `listRef.current.scrollTop = listRef.current.scrollHeight`

## 수정 파일
| 파일 | 변경 |
|------|------|
| `src/components/CategorySelector.tsx` | 스크롤 컨테이너 래핑, 드래그 자동 스크롤, 추가 후 자동 스크롤 |

## 기존 기능 영향
없음. 체크박스, 이름변경, 삭제, 드래그 정렬 모두 정상 동작.

