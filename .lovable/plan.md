

# 위첨자 불일치 근본 원인 및 해결 방안

## 원인 분석

Web UI와 PDF가 **같은 `computeSuperscriptPositions`**를 쓰지만, PDF 쪽에서 추가로 "원문 좌표 → 청크/세그먼트 좌표" 변환을 수행할 때 문제가 생김.

```text
Web UI:  original text → indexOf(targetText) → 위치에 <sup> 삽입 ✅ 정확

PDF:     original text → indexOf(targetText) → 절대 위치 계산 ✅
         절대 위치 → chunk/segment 좌표 변환 ❌ 여기서 틀림
```

구체적 원인:
- **line 249**: `fullTextLower.indexOf(chunkTextLower, cursor)` — 청크 텍스트를 원문에서 `indexOf`로 찾는데, 원문과 청크 텍스트가 **공백/따옴표/아포스트로피** 등에서 미세하게 다를 수 있음
- 예: 원문 `"He's going to be"` vs 청크 `"He 's going to be"` (토큰화 시 아포스트로피 분리)
- 이 차이로 cursor가 밀리면 뒤의 모든 청크 좌표가 잘못됨 → 위첨자가 엉뚱한 곳에 배치

## 해결: 청크 좌표를 indexOf가 아닌 직접 계산으로 변경

`indexOf` 기반 추측 매칭을 제거하고, 원문(original)에서 각 청크의 실제 시작 위치를 **순차 스캔**으로 정확히 계산.

### 수정 파일: `src/components/PdfDocument.tsx`

`renderChunksWithVerbUnderline` 함수의 chunkOffsets 계산 로직을 교체:

```text
현재 (불안정):
  chunkStart = fullTextLower.indexOf(chunkTextLower, cursor)
  → 반복 단어, 공백 차이 시 잘못된 위치 반환

개선 (안정적):
  원문에서 각 청크의 단어들을 순차적으로 찾아
  첫 단어의 위치 = 청크 시작, 마지막 단어 끝 = 청크 끝
  → indexOf 대신 단어 단위 매칭으로 정확한 좌표 보장
```

핵심 변경:
1. 원문을 단어 토큰으로 분해 (위치 정보 포함)
2. 각 청크의 단어들을 원문 토큰에서 순서대로 소비
3. 소비된 토큰의 위치로 정확한 start/end 계산
4. 세그먼트 좌표도 같은 방식으로 매핑

이 방식은 공백/구두점 차이에 영향받지 않음.

### 수정 범위
- `src/components/PdfDocument.tsx` — `renderChunksWithVerbUnderline` 내 chunkOffsets 계산부 (약 20줄)

