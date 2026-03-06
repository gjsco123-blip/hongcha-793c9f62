

## 문제

동/반의어 테이블에서 Synonym 텍스트가 긴 경우(예: "underline(밑줄 긋다/강조하다)", "conclude a bargain(계약을 체결하다)") 2줄로 줄바꿈됨. 현재 컬럼 비율(Word 23%, Syn 42%, Ant 35%)과 폰트 크기(7pt)로는 공간이 부족.

## 해결 방법

**`src/components/PreviewPdf.tsx`** — 폰트 축소 + 비율 재조정

1. **Synonym/Antonym 폰트 크기 축소**: 7pt → **6.5pt** (Word 컬럼은 7pt 유지)
2. **컬럼 비율 재조정**: Word **21%** → Synonym **46%** → Antonym **33%**
3. **패딩 축소**: synSyn paddingRight 6→4, synAnt paddingLeft 6→4

A4 가용 너비 515pt 기준:
- Word: 108pt (현재 118pt)
- Synonym: 237pt (현재 216pt) — **+21pt 확보**
- Antonym: 170pt (현재 180pt)

폰트 0.5pt 축소 + 너비 21pt 증가로 대부분의 긴 동의어 텍스트가 한 줄에 들어갈 수 있음. 반의어는 보통 2개 정도로 짧아 너비를 줄여도 문제없음.

