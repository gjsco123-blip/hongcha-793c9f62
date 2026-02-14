
## 통합 수정 계획: 동사 밑줄 정확성 + PDF 연속 밑줄

3가지 문제를 한번에 수정합니다.

---

### 1. 엔진 프롬프트 강화 — 동사 오태깅 방지

**파일:** `supabase/functions/engine/index.ts`

현재 프롬프트의 `<v>` 태그 규칙(88~89줄)을 확장하여:

- **명시적 금지 목록 추가**: `such as`, `as well as`, `rather than`, `according to`, `due to`, `because of` 등 전치사구/연결어는 절대 `<v>` 태깅 금지
- **올바른/잘못된 예시 제시**:
  - 잘못: `<c1>researchers <v>such as</v> Boas</c1>`
  - 올바름: `<c1>researchers such as Boas <v>studied</v> cultures</c1>`
- **동사구 단일 태깅 강화**: `were conducted`, `has been working` 같은 동사구는 반드시 하나의 `<v>` 태그로 감싸도록 명시
- **판별 기준**: "주어의 동작/상태를 나타내는 서술어(predicate)인지 확인. 전치사, 접속사, 부사, 형용사는 절대 불가"

### 2. PDF 동사구 밑줄 연속 렌더링

**파일:** `src/components/PdfDocument.tsx`

`renderChunksWithVerbUnderline` 함수를 **세그먼트 단위**로 변경:

- **현재**: `segmentsToWords()`로 단어 분리 후 각 단어마다 별도 `<Text style={underline}>` 생성 → 공백에 밑줄 없음 → 끊김
- **변경**: `chunk.segments`를 직접 순회하여 동사 세그먼트 전체를 하나의 `<Text style={verbUnderline}>`로 렌더링

```text
변경 전: [Text(were)] [공백] [Text(conducted)]  ← 밑줄 끊김
변경 후: [Text(were conducted)]                  ← 밑줄 연속
```

### 3. 웹 UI 동사 밑줄 일관성

**파일:** `src/components/ResultDisplay.tsx`

동일하게 세그먼트 단위 렌더링으로 변경. 동사구가 하나의 `<span className="underline">`으로 감싸져 연속 밑줄 표시.

(참고: `ChunkEditor.tsx`는 단어별 더블클릭 동사 토글 기능이 있으므로 단어 단위 렌더링 유지)

---

### 수정 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/functions/engine/index.ts` | 프롬프트에 금지 목록, 예시, 판별 기준 추가 |
| `src/components/PdfDocument.tsx` | 세그먼트 단위 밑줄 렌더링으로 교체 |
| `src/components/ResultDisplay.tsx` | 세그먼트 단위 밑줄 렌더링으로 교체 |

엔진 edge function은 변경 후 자동 재배포됩니다.
