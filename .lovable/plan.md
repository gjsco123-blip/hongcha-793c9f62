

## 구문분석 자동 생성 시 위첨자(superscript) 추가

### 문제
수동 드래그로 구문분석을 생성하면 `targetText`가 저장되어 영문 원문에 위첨자 번호가 표시되지만, 자동 생성 모드에서는 `targetText` 없이 `content`만 저장되어 위첨자가 나타나지 않음.

### 해결 방법

**1. Edge Function 수정 (`supabase/functions/grammar/index.ts`)**

- **Tool schema 변경**: `points`를 `string[]`에서 `{text: string, targetText: string}[]`로 변경
  - `text`: 기존 구문분석 설명
  - `targetText`: 원문에서 해당 문법 포인트가 적용되는 핵심 구문 (위첨자 위치용)

- **프롬프트 추가 지시**: 각 포인트마다 원문에서 해당 구문이 시작되는 핵심 단어/구문을 `targetText`로 반환하도록 지시 (예: "dating back to", "that pressures")

- **응답 파싱**: 새로운 객체 배열에서 `text`와 `targetText`를 각각 추출

**2. 프론트엔드 수정 (`src/pages/Index.tsx`)**

- 자동 생성 응답 처리 부분(line 461-466)에서 새 형식을 파싱하여 `targetText` 포함:
```ts
// 현재: { id: idx+1, content: line }
// 변경: { id: idx+1, content: point.text, targetText: point.targetText }
```

- 기존 string[] 폴백도 유지하여 하위 호환성 보장

### 변경 파일
| 파일 | 변경 내용 |
|------|-----------|
| `supabase/functions/grammar/index.ts` | tool schema + 프롬프트 + 파싱 (자동 모드) |
| `src/pages/Index.tsx` | 자동 생성 응답에서 targetText 추출 |

