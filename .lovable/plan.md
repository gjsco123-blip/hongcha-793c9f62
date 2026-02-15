

## 긴 청크 오버플로우 수정

### 문제
ChunkEditor에서 하나의 청크에 긴 문장이 들어가면 네모칸(border box)이 부모 컨테이너 너비를 초과하여 가로 스크롤이 생기거나 잘림.

### 해결

**파일:** `src/components/ChunkEditor.tsx`

각 청크의 wrapper `<div>`와 텍스트 `<span>`에 너비 제한과 줄바꿈을 허용하도록 수정.

| 요소 | 변경 전 | 변경 후 |
|------|---------|---------|
| 청크 wrapper `<div>` | `flex items-center gap-1` | `flex items-center gap-1 max-w-full` |
| 청크 텍스트 `<span>` | `inline-flex items-center gap-0.5 px-2 py-1 text-xs ...` | 동일 + `flex-wrap break-words max-w-full` 추가 |

또한 **ResultDisplay** 컴포넌트에도 동일한 오버플로우 방지 적용:

**파일:** `src/components/ResultDisplay.tsx`

| 요소 | 변경 내용 |
|------|-----------|
| 청크 `<span>` | `break-all` 또는 `break-words` 추가하여 긴 텍스트 줄바꿈 허용 |
| 청크 wrapper | `max-w-full` 추가 |

### 핵심
- 각 청크 박스가 부모 너비를 초과하지 않도록 `max-w-full` 제한
- 박스 내부 텍스트가 자연스럽게 줄바꿈되도록 `break-words`(단어 단위) 적용
- 청크 내 단어들의 `inline-flex`를 `flex-wrap`으로 변경하여 여러 줄 허용

