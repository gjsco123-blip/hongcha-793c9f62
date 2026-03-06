

## 문제

동/반의어 PDF 테이블에서 Synonym 컬럼의 텍스트가 길 때(예: "at the sacrifice of (~을 희생하여)") Antonym과 너무 붙거나, Synonym이 줄바꿈되면서 Antonym도 아래로 밀림.

## 원인

현재 고정 비율: Word 25%, Synonym 40%, Antonym 35%. Synonym 내용이 길면 Antonym과의 간격이 부족.

## 해결 방법

**`src/components/PreviewPdf.tsx`** — 비율 조정 + 패딩 추가

1. **컬럼 비율 변경**: Word 23% → Synonym 42% → Antonym 35% (Word를 약간 줄여 Synonym에 공간 확보)
2. **Synonym-Antonym 간 간격 확보**: `synSyn`에 `paddingRight: 6` 추가, `synAnt`에 `paddingLeft: 6` 추가
3. **Antonym 컬럼에 왼쪽 세로 구분선 추가**: `borderLeftWidth: 0.5, borderLeftColor: T.rule` — 시각적으로 두 컬럼을 명확히 분리

이렇게 하면 react-pdf의 flexbox가 자동으로 텍스트 줄바꿈을 처리하되, 컬럼 간 패딩으로 겹침/밀착 문제를 해결함. 별도의 자동 조절 로직 없이 CSS 패딩만으로 충분히 해결 가능.

### 변경할 스타일 (3줄)

```
synWord: { width: "23%", ..., paddingRight: 4 }
synSyn:  { width: "42%", ..., paddingLeft: 4, paddingRight: 6 }
synAnt:  { width: "35%", ..., paddingLeft: 6, borderLeftWidth: 0.5, borderLeftColor: T.rule }
```

