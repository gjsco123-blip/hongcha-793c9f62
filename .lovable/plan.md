
# PDF 영어 폰트 Helvetica -> Inter 변경

## 문제
- react-pdf 내장 Helvetica는 실제 인쇄 시 글자가 얇고 선명하지 않음
- 특히 작은 폰트 사이즈(7~10pt)에서 가독성이 떨어짐

## 해결 방안
영어 폰트를 **Inter**로 변경. Inter는 Pretendard와 같은 디자인 계열이라 한영 혼용 시 자연스럽고, Regular/Bold/SemiBold 등 다양한 weight를 지원하여 인쇄 품질이 우수함.

## 변경 내용

### 1. PassageBuilderPdf.tsx (Pre-Study Guide PDF)
- Inter 폰트 등록 (Regular 400 + SemiBold 600 + Bold 700)
- SemiBold 추가로 Bold가 너무 굵은 문제 해결 (어휘 단어 등에 SemiBold 적용)
- `fontFamily: "Helvetica"` -> `fontFamily: "Inter"` 전체 교체
- 어휘 단어(vocabWord): Bold(700) -> SemiBold(600)으로 변경하여 더 세련된 느낌
- 제목(title): Inter Bold 유지
- 섹션 배지(sectionBadge): Inter Bold 유지
- 구조 번호(stepNum): Inter SemiBold로 변경

### 2. PdfDocument.tsx (분석지 PDF)
- Inter 폰트 등록 (Regular 400 + SemiBold 600 + Bold 700)
- `fontFamily: "Helvetica"` -> `fontFamily: "Inter"` 전체 교체
- englishText: Inter Regular 유지
- passageText: Inter Regular 유지
- 구문 번호: Helvetica -> Inter로 변경

## 기술 세부사항

Inter 폰트 CDN 소스:
- Regular: `https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts@master/dist/Inter/Inter-Regular.ttf`  
  (또는 Google Fonts static TTF)
- SemiBold: Inter-SemiBold.ttf
- Bold: Inter-Bold.ttf

Google Fonts 공식 TTF 경로 사용:
```
https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2
```
-> TTF가 더 안정적이므로 GitHub 미러 또는 CDN의 .ttf 파일 사용

안정적인 소스로 rsms/inter GitHub 릴리스 사용:
```
https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/InterDisplay-Regular.otf
https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/InterDisplay-SemiBold.otf  
https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/InterDisplay-Bold.otf
```

## 기대 효과
- 인쇄 시 글자가 더 선명하고 균일한 두께로 출력
- 작은 사이즈에서도 높은 가독성
- Pretendard와 자연스러운 한영 조합
- SemiBold weight 활용으로 Bold 일변도가 아닌 세련된 타이포그래피
