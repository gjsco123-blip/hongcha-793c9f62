
## 구문분석 드래그 선택 텍스트 정리

### 문제 원인
청킹 UI를 단어별 개별 `<span>`으로 변경한 후, `window.getSelection().toString()`이 단어 사이에 줄바꿈(`\n`)을 삽입하고 청크 구분자(`/`)까지 포함시킴.

**이전 selectedText:** `"their modernisation being kept on hold or being given less and less space"`  
**현재 selectedText:** `"their\nmodernisation\nbeing\nkept\non\nhold\n/\nor\nbeing\ngiven\nless\nand\nless\nspace"`

이로 인해 grammar 함수가 문장을 제대로 분석하지 못하고 에러 메시지를 반환함.

### 수정 내용

#### 1. ChunkEditor.tsx - 선택 텍스트 정규화
`handleMouseUp`에서 `window.getSelection().toString()` 결과를 정리:
- 줄바꿈(`\n`)을 공백으로 변환
- 청크 구분자(`/`)를 제거
- 연속 공백을 하나로 합침

수정 위치: `handleMouseUp` 콜백 내 `text` 변수 처리 (약 30~31번 줄)

```typescript
const rawText = selection?.toString().trim();
const text = rawText
  ?.replace(/\s*\/\s*/g, " ")  // 구분자 / 제거
  .replace(/\s+/g, " ")        // 줄바꿈 + 연속공백 정리
  .trim();
```

#### 2. grammar edge function - 입력 정규화 강화 (방어적 처리)
`selectedText`에 대해서도 `oneLine()` 정규화를 이미 적용하고 있지만, 혹시 모를 `/` 문자를 추가로 제거.

수정 위치: `supabase/functions/grammar/index.ts` 내 `selected` 변수 처리

```typescript
const selected = oneLine(selectedText || "").replace(/\s*\/\s*/g, " ").trim();
```

### 수정 파일
- `src/components/ChunkEditor.tsx` (handleMouseUp 내 텍스트 정리)
- `supabase/functions/grammar/index.ts` (selectedText 입력 정규화)
