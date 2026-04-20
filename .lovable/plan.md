

## CHUNKING 영역 정돈 + 라벨 드래그 오염 차단

### 변경 1 — 청크 박스 정리 (시각 정돈)

**`src/components/ChunkEditor.tsx`**
- 청크 박스(`border border-border rounded-md bg-background`) 표시 조건을 변경:
  - **편집 모드**: 박스 유지 (분할/병합 클릭 영역 필요)
  - **일반 모드**: 박스 제거, 슬래시 구분자만 유지 → 라벨이 깔끔히 보임
- 청크 간 세로 간격 확대: 라벨 영역 확보를 위해 `gap-y` 증가 (`gap-1.5` → `gap-x-1.5 gap-y-5`)
- 슬래시 `/` 색상은 그대로 유지(`text-muted-foreground`)

```tsx
// 변경 예시
<span className={`inline px-2 py-1 text-xs font-english ${
  isEditing 
    ? "border border-border rounded-md bg-background" 
    : ""
} text-foreground break-words max-w-full`}>
```

### 변경 2 — 라벨이 드래그에 포함되지 않도록

**`src/components/ChunkEditor.tsx`의 `renderSvLabel`**
- 라벨 span에 `select-none` 클래스 + `user-select: none` 인라인 스타일 추가
- 추가 안전장치: `aria-hidden="true"` (스크린리더 중복 방지, 시각 라벨이므로)
- `handleMouseUp`의 텍스트 정규화는 그대로 두되, 안전망으로 라벨 패턴 제거 정규식 추가:
  ```ts
  .replace(/\b[sv]['′]?[₀-₉]?\b/g, "") // 라벨 잔재 방지
  ```
  → 단, 영어 단어 손상 위험이 있으므로 **`select-none`이 1차 방어선**, 정규식은 2차 방어선

### 변경 3 — 일관성 (선택)
ResultDisplay 본문에 SV 라벨이 노출되는 곳이 있다면 동일하게 `select-none` 적용. (확인 후 적용)

### 변경 파일
- `src/components/ChunkEditor.tsx` — 박스 조건부 + 간격 + select-none + selection 정규화
- `src/components/ResultDisplay.tsx` — 라벨에 동일 select-none (해당 시)

### 검증 포인트
1. 일반 모드에서 청크가 슬래시로만 구분되어 깔끔한지
2. 편집 모드에서는 박스가 유지되어 분할/병합 UX 문제없는지
3. 드래그로 영어 구문 선택 시 `v₁`, `s'` 같은 라벨이 selection에 안 들어가는지
4. 분석 요청 시 콘솔/네트워크 페이로드에 라벨 텍스트가 섞이지 않는지
5. 줄간격 확대로 페이지 전체 높이가 너무 길어지진 않는지 (gap-y-5 적정선 확인)

### 리스크
- `gap-y` 확대 시 화면 길이 증가 → 너무 크면 `gap-y-4`로 미세 조정
- 일반 모드에서 박스가 사라지면 청크 경계가 슬래시에만 의존하므로, 슬래시 색상이 너무 옅으면 가독성 저하 → 필요 시 `text-muted-foreground/70`로 살짝 진하게
- `select-none`은 모든 모던 브라우저 지원. 사파리 포함 안전

