

# 구문분석 약어 규칙 + PDF 폰트 변경

## 변경 1: 구문분석 프롬프트에 물결(~) 약어 규칙 추가

**파일:** `supabase/functions/grammar/index.ts`

현재 프롬프트의 출력 예시를 보면 영어 단어를 길게 인용하는 경우가 많음. 스크린샷 예시처럼 `parenting~craft를 대신하는`과 같이 연속된 영어 구문을 물결(~)로 축약하는 규칙을 추가.

**프롬프트에 추가할 규칙:**

"문장 스타일 규칙" 섹션에 다음 항목 추가:
- 연속된 영어 단어를 인용할 때, 3단어 이상이면 첫 단어~마지막 단어로 축약 (예: "parenting improves when it is practiced as a skilled craft" → "parenting~craft")
- 2단어 이하는 그대로 표기

출력 예시도 이에 맞게 업데이트:
- 기존: `to부정사구 to act...와 to serve...가 and로 병렬 연결되어`
- 변경: `to act~와 to serve~가 and로 병렬 연결되어` (이미 짧은 경우는 유지)

## 변경 2: PDF 폰트를 Noto Sans KR로 교체

**파일:** `src/components/PdfDocument.tsx`

- Nanum Gothic 폰트 등록을 Noto Sans KR로 교체
- Google Fonts CDN에서 Noto Sans KR TTF 파일 URL 사용:
  - Regular (400): `https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf`
  - Bold (700): `https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.ttf`
- `fontFamily: 'Nanum Gothic'` → `fontFamily: 'Noto Sans KR'`로 변경

---

## 기술 상세

| 파일 | 변경 내용 |
|------|----------|
| `supabase/functions/grammar/index.ts` | 프롬프트 문장 스타일 규칙에 물결 축약 규칙 추가 + 출력 예시 업데이트 |
| `src/components/PdfDocument.tsx` | Font.register를 Noto Sans KR로 교체, page 스타일의 fontFamily 변경 |

