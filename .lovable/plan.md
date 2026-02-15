

## 청크 분할 토글 + 설명 텍스트 수정

### 변경 1: 분할 토글 기능

현재 `handleWordClick`은 단어 앞에서 분할만 가능. 이미 분할된 지점(청크의 첫 번째 단어)을 클릭하면 이전 청크와 병합되도록 수정.

**로직:**
- `wordIndex === 0`이고 `chunkIndex > 0`인 경우: 이전 청크와 병합 (분할 해제)
- `wordIndex > 0`인 경우: 기존처럼 분할
- `wordIndex === 0`이고 `chunkIndex === 0`인 경우: 무시 (첫 번째 청크의 첫 단어)

**파일:** `src/components/ChunkEditor.tsx`

`handleWordClick` 함수 수정:
```
if (wordIndex === 0) {
  if (chunkIndex === 0) return; // 맨 첫 단어는 무시
  // 이전 청크와 병합 (분할 해제)
  handleMerge(chunkIndex - 1);
  return;
}
// 기존 분할 로직 유지
```

### 변경 2: 설명 텍스트 수정

**파일:** `src/pages/Index.tsx` (433번째 줄)

| 변경 전 | 변경 후 |
|---------|---------|
| `✏️ 편집 · 더블클릭으로 동사 표시 · " / "로 분할` | `✏️ 편집 · 클릭: 분할/병합 · 더블클릭: 동사 표시` |

### 수정 파일
- `src/components/ChunkEditor.tsx` - 분할 토글 로직
- `src/pages/Index.tsx` - 설명 텍스트

