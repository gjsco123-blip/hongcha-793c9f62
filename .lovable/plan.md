

## S/V 라벨 굵기 원복

### 변경 사양
| 항목 | 현재 | 변경 후 |
|---|---|---|
| PDF 굵기 | SemiBold (600) | **기본 (400)** |
| 웹 굵기 | font-semibold (600) | **기본** |
| PDF 크기 | 7pt / sub 5pt | 유지 |
| 웹 크기 | 12px / 9px | 유지 |
| 색상 | #000 | 유지 |
| 자간 | -0.2pt (PDF) | 유지 |

### 변경 파일
- `src/components/PdfDocument.tsx` — `svLabelAbsolute`, `svLabelSub`에서 `fontWeight: 600` 제거
- `src/components/ResultDisplay.tsx` — 라벨 클래스에서 `font-semibold` 제거
- `src/components/ChunkEditor.tsx` — 동일 처리

### 검증
- 라벨이 너무 가늘어 보이지 않는지 (7pt 기본 굵기로도 가독성 충분한지)
- 페이지 수 변동 없음 확인

