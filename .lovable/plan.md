

## 문제 원인

엔진(`engine/index.ts`)의 시스템 프롬프트에 **한자(漢字) 사용 금지 규칙이 없음**. Gemini 모델이 한국어 직역 시 어려운 단어에 한자 병기(예: `현현(顯現)`)를 자의적으로 추가하는 경우가 발생.

이것은 중3·고1 대상 학습지에 부적절함.

## 수정

**파일**: `supabase/functions/engine/index.ts` — 시스템 프롬프트

CHUNKING RULES 섹션 하단 또는 별도 섹션에 다음 규칙 추가:

```
## KOREAN TRANSLATION RULES
- NEVER use Chinese characters (漢字/Hanja) in Korean translations.
- Write all Korean in pure Hangul only.
- Do NOT add parenthetical Hanja explanations like 현현(顯現).
- Use simple, natural Korean words appropriate for middle/high school students.
```

이 한 줄 프롬프트 추가로 모델이 한자를 출력하지 않도록 강제함. 별도 후처리(정규식으로 한자 제거)는 프롬프트 수정 후에도 문제가 지속될 경우에만 고려.

