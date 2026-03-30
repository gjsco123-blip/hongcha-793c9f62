

# 직역/의역/홍T 인쇄 가독성 개선

## 현재 설정
- `translationLabel` & `translationContent`: fontSize **6.5pt**, lineHeight **1.8**, letterSpacing/fontStretch 없음

## 인쇄소 권장 반영

| 항목 | 현재 | 변경 |
|------|------|------|
| fontSize | 6.5pt | **7.5pt** (+1pt) |
| 장평 (fontStretch) | 100% | **90%** → `transform: scaleX(0.9)` |
| 자간 (letterSpacing) | 0 | **-7%** → 약 **-0.5pt** (7.5 × 0.07) |

## 기술 구현 (`src/components/PdfDocument.tsx`)

`@react-pdf/renderer`는 CSS `font-stretch`를 지원하지 않으므로 `transform: scaleX(0.9)`로 장평 90%를 구현합니다.

### 변경할 스타일
1. **`translationLabel`** (line 168-175): fontSize 6.5→7.5, letterSpacing: -0.5 추가
2. **`translationContent`** (line 176-181): fontSize 6.5→7.5, letterSpacing: -0.5 추가
3. 직역/의역/홍T의 `<Text>` 요소에 `transform: "scaleX(0.9)"` 적용 (인라인 또는 공통 스타일)
4. 구문 섹션의 `translationContent` 스프레드(line 461)도 동일 적용
5. lineHeight는 폰트 증가에 맞춰 1.8 유지 또는 미세 조정 (줄 간격이 너무 벌어지면 1.6으로)

### 주의
- label 너비(`width: 17`)가 글자 크기 증가로 부족할 수 있으므로 18-19로 조정 필요
- 장평 축소로 전체 줄 길이가 줄어들어 페이지네이션에 영향은 거의 없음 (오히려 여유 생김)
- 구문 섹션 번호 영역도 동일 스타일 적용

