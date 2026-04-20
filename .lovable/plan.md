

## S/V 라벨 디자인 개선 — 크기·색상·위치·prime 순서

### 결정 사항
- **크기**: PDF 6pt / 웹 11px (subscript: PDF 4.5pt / 웹 8px)
- **색상**: 완전 블랙 `#000`
- **Prime 위치**: `v'₁` 형태 (base → prime → subscript 순서)
- **PDF 위치**: absolute positioning으로 단어 아래 가운데 정확히 배치 + 줄간격 100% 유지

### 변경 1 — `sv-labels.ts` 라벨 구조 조정

`SvLabel` 인터페이스는 그대로 유지 (`base`, `index?`, `prime`).
렌더링 측에서 prime을 subscript **앞**에 출력하도록 순서만 변경.

### 변경 2 — 웹 UI (`ResultDisplay.tsx`, `ChunkEditor.tsx`)

기존 렌더 구조 (`inline-flex flex-col items-center` + `height: 0; overflow: visible`) 유지. 스타일만 조정:

```tsx
<span className="text-[11px] leading-none text-black font-sans" style={{ marginTop: 3 }}>
  {lbl.base}
  {lbl.prime ? "'" : ""}
  {lbl.index !== undefined && (
    <sub className="text-[8px]" style={{ lineHeight: 1 }}>{lbl.index}</sub>
  )}
</span>
```

변경점:
- 폰트 크기 9px → 11px, subscript 7px → 8px
- 색상 `text-muted-foreground` → `text-black`
- prime을 subscript **앞**으로 이동
- marginTop 2px → 3px (밑줄에서 더 분리)

### 변경 3 — PDF (`PdfDocument.tsx`) — absolute positioning

현재: 인라인 `verticalAlign: "sub"` Text → 단어 옆에 붙음
변경: 각 verb/subject 세그먼트를 wrapper View로 감싸고, 라벨을 absolute로 띄움

```tsx
<View style={{ position: "relative" }}>
  <Text style={{ textDecoration: "underline" }}>{seg.text}</Text>
  {lbl && (
    <Text style={{
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 6,
      color: "#000",
      marginTop: 1.5,
      lineHeight: 1,
    }}>
      {lbl.base}
      {lbl.prime ? "'" : ""}
      {lbl.index !== undefined && (
        <Text style={{ fontSize: 4.5, verticalAlign: "sub" }}>{lbl.index}</Text>
      )}
    </Text>
  )}
</View>
```

핵심:
- `position: "absolute"` + `top: "100%"` → 라벨이 줄 흐름 밖에 떠 있음 → **줄간격 변동 0**
- `left: 0, right: 0, textAlign: "center"` → 단어 폭 기준 정확한 가운데 정렬
- `marginTop: 1.5pt` → 밑줄에서 살짝 떨어짐
- subscript는 inline `<Text>` + `verticalAlign: "sub"` (라벨 Text 안에서 자연스럽게)

### 변경 4 — 메모리 업데이트

`mem://features/sv-labels.md`의 렌더링 섹션 갱신:
- 크기/색상/prime 순서 변경 사항
- PDF absolute positioning 채택 (이전 메모는 inline subscript로 기록되어 있음 → 정정)

### 검증 포인트
1. **줄간격 회귀**: 라벨 적용 전/후 PDF 페이지 수 동일한지
2. **위치**: 단어 폭 가운데 + 밑줄 살짝 아래
3. **가독성**: `v'₁` 형태에서 prime이 subscript와 겹치지 않고 명확히 보이는지
4. **다음 줄 침범**: absolute 라벨이 다음 줄 텍스트와 시각적으로 충돌하지 않는지 (필요 시 marginTop 미세 조정)
5. **웹/PDF 일치**: 두 환경에서 라벨 형태가 동일하게 `v'₁`로 출력되는지

### 변경 파일
- `src/components/PdfDocument.tsx` — wrapper View + absolute label
- `src/components/ResultDisplay.tsx` — 크기·색상·prime 순서
- `src/components/ChunkEditor.tsx` — 동일
- `.lovable/memory/features/sv-labels.md` — 렌더링 사양 갱신

### 리스크
- react-pdf의 `position: "absolute"` + inline `<View>`가 줄바꿈 흐름 안에서 예상대로 동작하는지 실측 필요. 만약 라벨이 사라지거나 잘못된 위치로 가면 즉시 fallback (flex column + 라벨 컨테이너 `height: 0` 시도)
- 다음 줄과의 시각적 충돌 발생 시 marginTop을 0.5pt 단위로 미세 조정

