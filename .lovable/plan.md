

# Preview 페이지 자동저장 추가

## 개요
Index 페이지와 동일한 2초 디바운스 패턴으로 Preview 페이지에서도 vocab, synonyms, summary, examBlock 수정 시 자동으로 DB에 저장.

## 변경 파일: `src/pages/Preview.tsx`

### 1. 자동저장 로직 추가
- `useRef`로 `saveTimerRef` 생성
- `autoSave` 콜백: `passageId`가 있고, 생성 중(`isGenerating`)이 아닐 때만 동작
- `mergePassageStore`로 preview 스냅샷(`passage, pdfTitle, vocab, synonyms, summary, examBlock`)을 기존 `baseResultsJson`에 병합
- `categories.updatePassage` 대신 직접 `supabase.from("passages").update(...)` 호출 (Preview는 useCategories 미사용)
- 저장 후 `baseResultsJson` 갱신

### 2. 디바운스 트리거
- `useEffect`에서 `passage, vocab, synonyms, summary, examBlock` 변경 시 `autoSave()` 호출
- 타이머 2초, cleanup에서 clearTimeout

### 3. 기존 `handleTogglePreviewCompleted`와 충돌 방지
- 완료 토글은 즉시 저장이므로 그대로 유지
- 자동저장은 `passageId`가 없으면 skip (새 지문 직접 입력 시)
- DB 저장된 데이터 로드 완료 전(`loadingSavedState`)에는 자동저장 skip

