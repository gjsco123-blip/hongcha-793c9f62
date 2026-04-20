

## S/V 라벨 크기·굵기 미세 조정

### 변경 사양
| 항목 | 현재 | 변경 후 |
|---|---|---|
| PDF base | 6pt | **7pt** |
| PDF subscript | 4.5pt | **5pt** |
| PDF 굵기 | 기본(400) | **SemiBold(600)** |
| 웹 base | 11px | **12px** |
| 웹 subscript | 8px | **9px** |
| 웹 굵기 | 기본 | **font-semibold (600)** |
| 자간 | 0 | **-0.2pt (PDF)** |

### 줄간격 안전성 검증
- englishWord lineHeight 2.5 × fontSize 9.5pt = 23.75pt 라인 박스
- 라벨 시작점: top 9.5 + marginTop 0.5 = 10pt
- 라벨 7pt 차지 → 17pt 지점 종료
- 다음 줄까지 약 6.75pt 여유 → **회귀 없음**

### 변경 파일
- `src/components/PdfDocument.tsx` — `svLabelAbsolute` 스타일 업데이트
  - `fontSize: 7`, `letterSpacing: -0.2`, `fontFamily: "Pretendard"`, `fontWeight: 600`
  - 내부 subscript Text: `fontSize: 5`
- `src/components/ResultDisplay.tsx` — 웹 라벨 클래스 조정
  - `text-[11px]` → `text-[12px]`, `text-[8px]` → `text-[9px]`, `font-semibold` 추가
- `src/components/ChunkEditor.tsx` — 동일 처리

### 검증 포인트
1. PDF 페이지 수 변동 없는지
2. 라벨이 다음 줄과 시각적으로 충돌하지 않는지
3. SemiBold가 6~7pt에서 깔끔하게 렌더되는지 (뭉개지면 weight 500으로 폴백)
4. 웹/PDF 모두 동일한 비율감 유지

### 리스크
- Pretendard 600 italic은 등록되지 않았으므로 italic 절대 사용 금지 (이전 이슈 재발 방지)
- subscript가 5pt로 커지면 baseline이 살짝 더 내려갈 수 있음 → 필요 시 marginTop 0.5 → 0pt로 미세 조정

