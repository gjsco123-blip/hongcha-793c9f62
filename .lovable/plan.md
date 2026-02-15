

## 청크 편집 방식 개선: 편집 모드 + 확인 버튼

### 현재 문제
- 연필 아이콘 편집이 번거로움
- 클릭/더블클릭 시 즉시 반영되어 실수 시 되돌리기 어려움

### 변경 후 동작

1. **편집 모드 토글**: "편집" 버튼을 누르면 편집 모드 진입
2. **편집 모드에서**:
   - 싱글클릭: 클릭한 단어 기준으로 청크 분할 (미리보기)
   - 더블클릭: 동사 표시 토글 (미리보기)
   - `+` 버튼: 청크 병합 (미리보기)
   - 모든 변경은 내부 임시 상태(`draftChunks`)에만 반영
3. **"적용" 버튼**: 클릭 시 `draftChunks`를 `onChange`로 전달하여 실제 반영
4. **"취소" 버튼**: 변경사항 버리고 편집 모드 종료

### 제거 항목
- 연필 아이콘 편집 기능 (input 편집 모드 전체 삭제)
- `editingIndex`, `editValue`, `handleStartEdit`, `handleSave` 관련 코드 제거
- `Pencil` import 제거

### 기술 상세

**파일:** `src/components/ChunkEditor.tsx`

1. **상태 추가**:
   - `isEditing: boolean` - 편집 모드 여부
   - `draftChunks: Chunk[]` - 편집 중 임시 청크 데이터
   - `clickTimerRef: useRef` - 싱글/더블클릭 구분용 타이머

2. **새 함수**:
   - `handleEnterEdit()`: 편집 모드 진입, `draftChunks = chunks` 복사
   - `handleApply()`: `onChange(draftChunks)` 호출 후 편집 모드 종료
   - `handleCancel()`: `draftChunks` 버리고 편집 모드 종료
   - `handleWordClick(chunkIndex, wordIndex)`: 클릭한 단어 기준 분할 (draftChunks에 반영)
   - `handleVerbToggle`: draftChunks에 반영하도록 수정

3. **클릭 구분 로직**:
   - `onClick` → 250ms 타이머 설정, 만료 시 분할 실행
   - `onDoubleClick` → 타이머 취소 후 동사 토글 실행

4. **렌더링**:
   - 편집 모드가 아닐 때: 현재와 유사하게 읽기 전용 표시 (클릭 불가)
   - 편집 모드일 때: `draftChunks` 기반 렌더링, 클릭/더블클릭 활성화
   - 상단에 "편집" / "적용" / "취소" 버튼 표시

5. **제거 항목**:
   - `editingIndex`, `editValue` 상태
   - `handleStartEdit`, `handleSave` 함수
   - `Pencil` import 및 연필 아이콘 버튼
   - input 편집 UI 전체

### UI 레이아웃

```text
[편집 버튼]  (편집 모드가 아닐 때)

편집 모드:
[적용] [취소]
[chunk1] + / [chunk2] + / [chunk3]
  ↑ 단어 클릭=분할, 더블클릭=동사표시
```

### 수정 파일
- `src/components/ChunkEditor.tsx`

