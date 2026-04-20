

## 슬래시 앞 간격 복구 — 1줄 수정

### 원인
청크 컨테이너 구조:
```
[청크 div (gap-1)]   외부 gap-x-1.5   [청크 div]
  단어들  슬래시          ↑ 여기는 넓음
       ↑ 여기가 좁음 (gap-1 = 4px)
```
- 슬래시(`/`)가 청크 div **내부 끝**에 위치 → 슬래시 앞쪽은 청크 내부 `gap-1`(4px), 뒤쪽은 외부 `gap-x-1.5`(6px) + 다음 청크 패딩 효과
- 일반 모드에서 청크 박스(border + px-2 패딩)를 제거하면서 시각적 좌우 균형이 더 깨져 보임
- **SV 라벨 기능과는 무관** — 라벨은 단어 span 안쪽에 absolute로 떠 있어서 슬래시 위치에 영향 0

### 해결
`src/components/ChunkEditor.tsx` 라인 390 — 슬래시 span에 좌측 마진 한 줄만 추가:

```tsx
// Before
<span className="text-muted-foreground text-xs">/</span>

// After
<span className="text-muted-foreground text-xs ml-1">/</span>
```

`ml-1`(4px)을 추가하면 슬래시 앞 간격이 청크 div 내부 `gap-1`(4px)에 더해져 총 8px → 외부 gap-x-1.5(6px)와 시각적으로 균형 맞음.

### SV 라벨 기능과의 충돌 검증
- SV 라벨은 `renderSvLabel`로 단어 span 내부에 `inline-flex flex-col`로 렌더 (height: 0, absolute-like)
- 슬래시 span은 청크 div 끝의 별도 텍스트 노드
- 두 요소는 DOM 트리에서 완전히 분리됨 → **충돌 없음**
- `select-none`도 슬래시에는 영향 없음

### 변경 파일
- `src/components/ChunkEditor.tsx` — 1줄 (슬래시 span에 `ml-1` 추가)

### 검증 포인트
1. 슬래시 양쪽 간격이 균등해 보이는지 (이전 사진과 비슷한 느낌)
2. 편집 모드(박스 있음)에서도 어색하지 않은지
3. SV 라벨이 여전히 단어 밑에 정확히 위치하는지
4. 줄바꿈 시 슬래시가 어색한 위치로 떨어지지 않는지
5. 너무 넓다 싶으면 `ml-1` → `ml-0.5`로 조정

### 답: 매우 간단한 문제 맞음
CSS 한 클래스 추가로 끝, SV 라벨 기능과 완전히 독립적이라 회귀 위험 0.

