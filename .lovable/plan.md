

# analyze-preview — flash-preview 복귀 + Self-Critique 2-Pass + Temperature 명시

## 수정 파일
`supabase/functions/analyze-preview/index.ts` (1개)

## 변경 1 — 모델 롤백 + Temperature 명시

`callAi` 함수 수정:

```ts
// Before
body: JSON.stringify({
  model: "google/gemini-3.1-pro-preview",
  messages,
}),

// After
body: JSON.stringify({
  model: "google/gemini-3-flash-preview",
  messages,
  temperature: 0.25,
}),
```

- 모델 → flash-preview로 복귀 (속도 회복)
- temperature 0.25 명시 → 규칙 추종성↑, 출력 안정성↑

## 변경 2 — Self-Critique 2-Pass 도입

기존 흐름:
```
1차 호출 → 프로그램 검증(45~58자) → 범위 밖이면 1회 재요청 → 반환
```

새 흐름:
```
1차 호출(생성)
  ↓
2차 호출(Self-Critique: AI가 자기 결과 평가 + 필요 시 수정)
  ↓
프로그램 검증(45~58자)
  ↓ 범위 밖
3차 호출(기존 재요청 — 안전망)
  ↓
반환
```

### Self-Critique 호출 메시지 (2차)

기존 `[system, user, assistant(1차결과)]` 뒤에 다음 user 메시지 추가:

```
다음 체크리스트로 이전 응답을 평가하고, 하나라도 미달이면 수정 후 동일 JSON으로 다시 출력할 것.

[Passage Logic 체크리스트]
1. ①②③④ 각 줄 글자수가 한국어 45~58자(공백·번호 포함)인가? 
   → 짧으면 [주체]+[원인/메커니즘]+[결과/결론] 3요소 중 누락된 것을 추가해 늘릴 것.
2. 각 줄이 명사형 종결(~점/구조/경향/방식 등)인가? 동사 종결·음슴체 금지.
3. 원문의 논리 구조(대비/인과/양보/문제해결)가 ④번 결론 줄에 정확히 반영됐는가?
4. 원문에 없는 평가·주장·예측이 추가되지 않았는가?

[exam_block 체크리스트]
5. topic이 단순 설명이 아니라 명확한 CLAIM(주장)인가?
6. title이 5~9 단어 명사구(abstract noun + of + key concept 권장)인가?
7. one_sentence_summary가 정확히 한 문장이며 논리 구조를 반영하는가?

평가 결과 모든 항목 충족이면 1차 응답을 그대로 다시 출력. 
하나라도 미달이면 수정한 결과를 동일 JSON 형식으로 출력.
JSON 객체 외 다른 텍스트 출력 금지.
```

### 코드 구조

`serve` 핸들러 내부:

```ts
// 1차 호출 (생성)
let content = await callAi(LOVABLE_API_KEY, [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: passage },
]);

// 2차 호출 (Self-Critique) — 신규
try {
  const critiqueContent = await callAi(LOVABLE_API_KEY, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: passage },
    { role: "assistant", content },
    { role: "user", content: SELF_CRITIQUE_PROMPT },
  ]);
  // 2차 결과가 파싱 가능하면 채택, 아니면 1차 유지
  const critiqueParsed = safeParseJson(critiqueContent);
  if (critiqueParsed?.summary && critiqueParsed?.exam_block) {
    content = critiqueContent;
    console.log("[analyze-preview] self-critique applied");
  }
} catch (e) {
  console.warn("[analyze-preview] self-critique failed, using 1st response:", e);
}

let parsed = safeParseJson(content);

// 3차 호출 (기존 안전망) — 그대로 유지
if (summaryHasOutOfRangeLine(parsed?.summary)) {
  // ... 기존 재요청 로직 그대로
}
```

## 안 건드리는 것
- 시스템 프롬프트 본문(CRITICAL LENGTH RULE, Few-shot, Self-check 섹션) 그대로
- 후처리 안전망(`summaryHasOutOfRangeLine` 검증) 그대로
- 429 처리, JSON 파싱, 평균 길이 비교 로직 그대로
- 프론트엔드 코드 무변경
- 다른 엣지 함수 무변경

## 기대 효과

| 항목 | 변화 |
|---|---|
| 응답 속도 | Pro 대비 30~50% 빠름 (flash 2회 < Pro 1회) |
| 비용 | Pro 대비 1/3~1/4 |
| 길이 규칙 준수율 | Pro의 85~90% 수준 |
| 논리 구조 보존 | 2-Pass 평가로 안정성↑ |
| 안전망 단계 | 2단계 → 3단계 (생성 → AI비판 → 프로그램검증) |

## 트레이드오프

- 호출 횟수 1 → 2 (안전망 발동 시 최대 3). 다만 flash가 빨라서 체감 지연 작음
- 2차 호출 실패 시에도 1차 결과로 fallback → 안정성 보장

## 롤백
- 2-Pass만 끄고 싶으면: 2차 호출 블록만 주석 처리
- 모델 다시 Pro로 올리고 싶으면: 모델 1줄 + temperature 1줄 변경

## 배포
`analyze-preview` 함수 재배포 1회.

