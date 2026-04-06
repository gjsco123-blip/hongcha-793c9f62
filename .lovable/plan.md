

# 동사 밑줄(`<v>` 태그) 누락 방지 — 검증 안전장치 추가

## 문제 정리
- 프롬프트에는 일반동사(`had`, `studied` 등), be동사(`is`, `was` 등) 태깅 규칙이 이미 충분히 명시되어 있음
- 문제는 **2차 검증 패스**(331~405줄)에서 AI가 응답할 때:
  1. 마크다운 코드블록(` ```xml ... ``` `)으로 감싸서 반환하는 경우
  2. `<v>` 태그를 실수로 제거하는 경우
- 현재 안전 검사(`extractText` 비교)는 순수 텍스트만 비교하므로, **태그만 빠지고 텍스트는 동일한 경우를 감지하지 못함**

## 수정 내용 (`supabase/functions/engine/index.ts`)

384~401줄 검증 결과 적용 로직 수정:

### 1) 마크다운 코드블록 제거
검증 AI 응답에서 ` ```...``` ` 래퍼를 strip

### 2) `<v>` 태그 수 비교 안전장치
- 원본의 `<v>` 태그 수 vs 검증 결과의 `<v>` 태그 수 비교
- 원본에 `<v>`가 있었는데 검증 결과에 0개 → **폐기**
- 검증 결과의 `<v>` 수가 원본의 50% 미만 → **폐기**

```text
수정 전:
  if (verified) {
    const verifiedText = normalize(extractText(verified));
    const originalText = normalize(extractText(lastResult.english_tagged));
    if (verifiedText === originalText) {
      lastResult.english_tagged = verified;  ← 태그 사라져도 통과
    }
  }

수정 후:
  if (verified) {
    // 마크다운 래퍼 제거
    let cleaned = verified.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

    const verifiedText = normalize(extractText(cleaned));
    const originalText = normalize(extractText(lastResult.english_tagged));
    const origVCount = (lastResult.english_tagged.match(/<v>/g) || []).length;
    const newVCount = (cleaned.match(/<v>/g) || []).length;

    if (verifiedText === originalText) {
      if (origVCount > 0 && newVCount === 0) {
        console.warn("Verb verification: all <v> tags stripped, discarding");
      } else if (origVCount > 0 && newVCount < origVCount * 0.5) {
        console.warn("Verb verification: too many <v> tags lost, discarding");
      } else if (cleaned !== lastResult.english_tagged) {
        console.log("Verb verification: corrected <v> tags");
        lastResult.english_tagged = cleaned;
      } else {
        console.log("Verb verification: no changes needed");
      }
    } else {
      console.warn("Verb verification: text changed, discarding");
    }
  }
```

## 수정 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/engine/index.ts` | 384~401줄: 마크다운 strip + `<v>` 태그 수 안전장치 |

## 기존 기능 영향
없음. 검증 패스가 정상적으로 태그를 수정/추가하는 경우는 그대로 동작.

