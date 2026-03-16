

# "it" 등 짧은 단어 선택 시 구문분석 버튼이 안 뜨는 문제

## 원인

`src/components/ChunkEditor.tsx` line 37에서 선택된 텍스트 길이를 `text.length > 2`로 필터링하고 있음. "it"은 정확히 2글자이므로 조건을 통과하지 못해 툴팁이 표시되지 않음.

## 해결

`text.length > 2` → `text.length >= 1`로 변경하여 단일 단어(it, be, do 등)도 선택 구문분석이 가능하도록 함. 최소 1글자 이상이면 충분.

### 변경 파일
- `src/components/ChunkEditor.tsx` — line 37의 조건만 수정 (1줄)

