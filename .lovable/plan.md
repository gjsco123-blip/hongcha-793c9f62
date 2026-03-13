

# 위첨자 누락 원인 분석 및 해결 방안

## 문제 원인

웹 UI와 PDF에서 위첨자(superscript) 매칭 로직이 **근본적으로 다릅니다.**

### 웹 UI (`renderWithSuperscripts`)
- **원문 전체 텍스트**에서 `targetText`를 검색
- `"Their access to information in multiple markets enabled them to easily cover the risks associated with agricultural commodity trade."`
- → `"enabled"` 찾기 성공 → 위첨자 ¹ 표시

### PDF (`renderChunksWithVerbUnderline`)
- **개별 chunk 텍스트**에서 `targetText`를 검색
- chunk1: `"Their access to information in multiple markets"`
- chunk2: `"enabled them"`
- chunk3: `"to easily cover the risks"`
- chunk4: `"associated with agricultural commodity trade."`

문제는 여기서 발생합니다. `targetText`가 chunk 경계를 걸치거나, chunk 내 텍스트와 대소문자/공백/구두점 차이가 있으면 PDF에서는 매칭 실패 → 위첨자 누락.

예를 들어 `targetText`가 `"markets enabled"` 처럼 두 chunk에 걸쳐있다면, 웹에서는 원문에서 찾지만, PDF에서는 어떤 개별 chunk에서도 찾을 수 없습니다.

## 해결 방안

`renderChunksWithVerbUnderline` 함수에서 **개별 chunk가 아닌 원문(original) 텍스트 기준**으로 매칭하도록 수정합니다.

### 수정 파일
- `src/components/PdfDocument.tsx` — `renderChunksWithVerbUnderline` 함수

### 수정 내용

1. **원문 기반 매칭**: 각 chunk의 텍스트를 연결한 전체 텍스트(또는 `original` 파라미터)에서 `targetText`의 위치(글자 인덱스)를 찾음
2. **글자 인덱스 → chunk/segment 매핑**: 전체 텍스트에서의 매치 위치를 각 chunk-segment 좌표로 변환
3. **기존 렌더링 로직 유지**: superscriptMap에 올바른 `ci-si` 키와 offset으로 매핑되면 나머지 렌더링은 그대로 동작

```text
현재 흐름:
  for each annotation:
    for each chunk:
      chunk.text.indexOf(targetText) → 매칭
  → chunk 경계 걸치면 실패

수정 흐름:
  fullText = chunks.map(c => c.text).join(" ")  (또는 original 사용)
  for each annotation:
    fullText.indexOf(targetText) → 전체에서 위치 찾기
    위치를 chunk/segment 좌표로 변환 → superscriptMap에 추가
  → chunk 경계 무관하게 항상 매칭 성공
```

핵심: 매칭 위치를 찾은 후, 해당 위치가 속하는 chunk의 **첫 번째 글자 위치에 해당하는 segment**에 superscript를 배치합니다. 이렇게 하면 웹 UI와 동일한 결과를 보장합니다.

### 변경하지 않는 것
- 웹 UI 코드 (이미 정상 동작)
- PDF 렌더링/스타일
- 페이지네이션 로직

