

# 구문분석 마커 변경 + PDF 적용

## 1. 마커 변경: ★ → •

`supabase/functions/grammar/index.ts` 프롬프트에서 모든 `★`를 `•`(작은 검은색 점)로 변경하고, 모델을 `google/gemini-2.5-flash`로 변경합니다.

## 2. PDF에 구문분석 추가

**PdfDocument.tsx**: 의역 행 아래에 구문분석(syntaxNotes) 표시
- 라벨: "구문" (볼드)
- syntaxNotes가 비어있으면 생략

**usePdfExport.ts**: SentenceResult 인터페이스에 `syntaxNotes?: string` 추가

## 변경 파일

| 파일 | 내용 |
|------|------|
| `supabase/functions/grammar/index.ts` | ★→• 변경, 모델 flash로 변경 |
| `src/components/PdfDocument.tsx` | 의역 아래 구문분석 렌더링 |
| `src/hooks/usePdfExport.ts` | 인터페이스에 syntaxNotes 추가 |

