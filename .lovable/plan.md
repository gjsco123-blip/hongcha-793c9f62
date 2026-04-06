

# 청킹-직역 경계 불일치 원인 및 해결

## 원인 분석

현재 엔진(`engine/index.ts`)의 검증 로직(290~328줄)은 영어와 한국어의 **청크 개수(`<cN>` 태그 수)**만 비교한다. 개수가 같으면 통과시키기 때문에:

1. **개수는 같지만 경계가 다른 경우**: 영어에서 `<c3>they do so</c3> <c4>from within a specific paradigm.</c4>`처럼 2개로 나눈 부분을 한국어에서는 `<c3>그들은 그렇게 한다</c3> <c4>특정한 패러다임 안으로부터 말이다.</c4>`로 의미 단위가 다르게 묶일 수 있음
2. **개수가 달라 3회 재시도 후 포기한 경우**: 327줄에서 `"Max attempts reached, using last result"`로 불일치 결과를 그대로 반환

핵심 문제: **각 `<cN>` 번호가 영어/한국어에서 동일한 의미 단위에 대응하는지 검증하지 않음**

## 해결 방안

### 1) 태그 번호 1:1 대응 검증 추가
개수뿐 아니라, 영어에 존재하는 모든 태그 번호(`c1, c2, ... cN`)가 한국어에도 동일하게 존재하는지 확인

### 2) 불일치 시 한국어 재생성 경량 호출
영어 청킹은 유지한 채, 한국어 직역만 다시 생성하는 보정 패스 추가. 영어 태그 구조를 그대로 제공하고 "이 구조에 맞춰 번역하라"고 지시

### 3) 프롬프트 강화
기존 프롬프트의 CHUNKING RULES에 더 명확한 제약 추가

## 수정 내용 (`supabase/functions/engine/index.ts`)

### A. 태그 번호 매칭 함수 추가
```text
function getTagNumbers(tagged: string): number[] {
  return [...tagged.matchAll(/<c(\d+)>/g)].map(m => Number(m[1])).sort((a, b) => a - b);
}
```

### B. 검증 로직 강화 (308줄 부근)
기존 `tagMatch`를 단순 개수 비교에서 번호 배열 비교로 변경:
```text
const enTags = getTagNumbers(lastResult.english_tagged);
const krTags = getTagNumbers(lastResult.korean_literal_tagged);
const tagMatch = JSON.stringify(enTags) === JSON.stringify(krTags);
```

### C. 한국어 직역 보정 패스 추가 (329줄, 동사 검증 전)
3회 재시도 후에도 태그 불일치가 남아있으면, 영어 청킹 구조를 기준으로 한국어 직역만 재생성:
```text
// 태그 불일치 보정
if (JSON.stringify(getTagNumbers(lastResult.english_tagged)) 
    !== JSON.stringify(getTagNumbers(lastResult.korean_literal_tagged))) {
  
  const repairPrompt = `영어 문장이 다음과 같이 청킹되어 있다:
${lastResult.english_tagged}

이 태그 구조(<c1>~</c1>, <c2>~</c2>, ...)를 **정확히 동일하게** 유지하면서
각 청크를 한국어로 직역하라. 반말 종결(~했다, ~이다)로 작성.
반드시 같은 번호의 <cN> 태그를 사용할 것.`;

  // AI 호출 → 응답을 korean_literal_tagged에 적용
  // 태그 번호 재검증 후 일치하면 채택, 아니면 기존 유지
}
```

### D. 프롬프트 보강 (173줄 CHUNKING RULES)
```text
- CRITICAL: <c1> in english_tagged MUST correspond to <c1> in korean_literal_tagged,
  <c2> to <c2>, etc. Each numbered chunk must translate the SAME phrase boundary.
  Do NOT merge or split chunks differently between English and Korean.
```

## 수정 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/engine/index.ts` | 태그 번호 매칭 함수, 검증 강화, 한국어 보정 패스, 프롬프트 보강 |

## 기존 기능 영향
없음. 이미 일치하는 결과는 그대로 통과. 불일치 시에만 보정 시도.

