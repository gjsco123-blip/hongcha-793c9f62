

# one_sentence_summary_ko 직역화 (topic_ko / title_ko 제외)

## 수정 파일
`supabase/functions/analyze-preview/index.ts`

## 변경 1 — 시스템 프롬프트: `one_sentence_summary_ko`만 직역 규칙 강화

`exam_block` 6번 항목을 상세 규칙으로 확장:

```
6. exam_block.one_sentence_summary_ko (한글 직역):
   - 영문 one_sentence_summary의 직역(literal translation).
   - 영문 어순·구조·핵심 명사를 최대한 보존할 것.
   - 영문 단어가 한글에서 1:1로 추적 가능해야 함 (학생이 영문↔한글 짝지어 읽기 가능).
   - 영문에 없는 부연·예시·평가어 추가 금지.
   - 핵심 명사는 그대로 옮길 것 (예: "long-term decision-making" → "장기적 의사결정").
   - 자연스러운 한국어 어순 조정은 허용하나, 의미 단위(주어/동사/목적어/수식구) 순서를 임의로 뒤집지 말 것.
   - 종결: "~한다 / ~이다 / ~된다" 평서문 동사 종결 (명사형 종결 금지).
   - 한자어 금지, 한글만.
   - 금지어: "~을 시사한다 / ~을 의미한다 / ~라고 볼 수 있다" 같은 해설성 표현 (영문에 그런 표현이 있을 때만 허용).

   예시:
   영문: "Immediate rewards systematically distort long-term decision-making by exploiting evolutionary biases in the human brain."
   Good: "즉각적 보상은 인간 두뇌의 진화적 편향을 이용해 장기적 의사결정을 체계적으로 왜곡한다."
   Bad: "사람들은 당장의 만족 때문에 미래를 제대로 못 본다는 점이 문제다."
```

`topic_ko`(2번), `title_ko`(4번)는 **변경 없음** — 현재 규칙 유지.

## 변경 2 — Self-Critique 체크리스트에 1개 항목 추가

`SELF_CRITIQUE_PROMPT`의 `[exam_block 체크리스트]` 끝에:

```
8. one_sentence_summary_ko가 영문의 직역인가?
   - 영문의 핵심 명사·동사가 한글에서 1:1 추적 가능한가?
   - 영문에 없는 해설·평가·예시가 추가되지 않았는가?
   - "~을 시사한다 / ~라고 볼 수 있다" 같은 임의 해설어가 들어가지 않았는가?
   미달이면 직역 원칙으로 다시 작성할 것.
```

(topic_ko / title_ko 관련 체크는 추가하지 않음)

## 안 건드리는 것
- 모델(flash-preview), temperature(0.25)
- `topic_ko`, `title_ko` 프롬프트
- 영문 `topic` / `title` / `one_sentence_summary` 생성 규칙
- `summary` (Passage Logic ①②③④) 규칙
- 후처리 검증, 재요청 로직, 프론트엔드, 다른 엣지 함수

## 트레이드오프
- 한글이 약간 덜 자연스러워질 수 있음 — 학생 학습용 의도된 트레이드오프

## 캐싱 주의
`sessionStorage.preview-state` 캐시 → 새 결과 보려면 **재생성 버튼** 또는 새 지문 필요

## 롤백
시스템 프롬프트의 6번 확장 블록 + Critique 8번 항목만 삭제

## 배포
`analyze-preview` 함수 재배포 1회

