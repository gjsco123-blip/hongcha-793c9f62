

## S/V 라벨 시스템 — 디자인 조정 (subscript 스타일 + 줄간격 유지)

### 수정 사항 (이전 플랜에 추가)

**1. 라벨 표기 — subscript 스타일**
- 기존 안: `v1`, `v2` (숫자가 본문과 같은 크기)
- 변경: 사진처럼 **`v` + 작은 아래첨자 `1`** 형태로 표시
- 구조: 기본 글자(`v`/`s`) + subscript 숫자(`1`,`2`) + prime(`'`)
  - 주절 단독 동사: `v`
  - 주절 병렬 동사: `v₁`, `v₂` (숫자만 작게)
  - 종속절 단독 동사: `v'`
  - 종속절 병렬 동사: `v₁'`, `v₂'`
- 주어도 동일 규칙 (`s`, `s₁`, `s'`, `s₁'`)

**2. 라벨 크기 축소 + 줄간격 보존**
- 이전 플랜은 PDF `lineHeight`를 2.5 → 2.9로 늘리려 했음 → **폐기**
- 변경: **PDF 줄간격은 현재 값 그대로 유지** (페이지 수 변동 없음)
- 라벨이 줄간격을 침범하지 않도록:
  - 라벨 크기를 더 작게: PDF 4.5pt, 웹 9px (기존 5.5pt/10px에서 축소)
  - subscript 숫자는 더 작게: PDF 3.5pt, 웹 7px
  - 라벨 영역 높이가 기존 줄간격 여백 안에 들어가도록 측정·조정

**3. 밑줄과 라벨 사이 간격**
- 라벨이 밑줄에 붙지 않도록 살짝 떨어뜨림
- 웹: `marginTop: 2px` (밑줄 offset 3px와 별개로 추가 여백)
- PDF: `marginTop: 1.5pt`

**4. 위치/정렬**
- 가운데 정렬 (변경 없음)
- 폰트: Pretendard (변경 없음)

### 렌더링 구현 메모

**웹 (ResultDisplay/ChunkEditor)**
```
<span class="inline-flex flex-col items-center align-baseline">
  <span class="underline decoration-2 underline-offset-[3px]">read</span>
  <span class="text-[9px] text-muted-foreground leading-none mt-[2px] font-pretendard">
    v<sub class="text-[7px]">1</sub>'
  </span>
</span>
```
- `inline-flex flex-col`로 단어 위·라벨 아래 배치
- 라벨이 line-box를 늘리지 않도록 `leading-none`
- 부모 `<p>`의 `line-height`는 현재 값 유지 — 라벨이 다음 줄을 밀지 않게 라벨 컨테이너에 `height: 0; overflow: visible` 적용 검토 (실제 줄 높이를 키우지 않음)

**PDF (PdfDocument)**
- react-pdf의 inline `View`는 baseline 정렬 제약이 있음
- 해법: 동사/주어 세그먼트를 `<View style={{ flexDirection: 'column', alignItems: 'center' }}>` 로 감싸되, **줄 높이가 늘어나지 않도록** 라벨 `<Text>`에 `position: 'absolute'` + 부모 `position: 'relative'` 사용
  - 라벨이 줄 흐름 밖에 떠 있게 → lineHeight 영향 0
  - PDF에서 absolute 텍스트는 가능 (검증된 패턴: PdfHeader)
- subscript 숫자: 별도 `<Text>` 더 작게, `style={{ fontSize: 3.5, lineHeight: 1 }}`

### 변경 파일 (이전 플랜과 동일, 스타일만 조정)
- `supabase/functions/engine/index.ts`
- `src/lib/chunk-utils.ts`
- `src/lib/sv-labels.ts` (신규) — 라벨 텍스트 + subscript 분리 반환
- `src/components/ResultDisplay.tsx`
- `src/components/ChunkEditor.tsx`
- `src/components/PdfDocument.tsx` (lineHeight 변경 없음, absolute 라벨)
- `src/pages/Index.tsx`
- DB migration: `feature_flags` insert (`sv_labels`)
- `.lovable/memory/features/subject-underline.md`
- `.lovable/memory/features/sv-labels.md` (신규)

### 검증 포인트
- PDF 페이지 수가 라벨 적용 전후 동일한지 (회귀)
- 라벨이 다음 줄 단어를 가리지 않는지 (overflow visible)
- 밑줄과 라벨 사이 시각적 여백 확인
- `v₁` 형태가 사진과 유사하게 렌더되는지 (특히 PDF)

