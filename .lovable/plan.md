

# 직역·의역 반말(~했다/~이다) 스타일 통일

## 리스크 분석

**다른 기능에 문제 없음.** 이유:

1. **직역(korean_literal_tagged)**: 청크 단위 번역이라 종결 스타일이 청킹 로직·태그 매칭·verb 태깅에 전혀 영향 없음
2. **의역(korean_natural)**: 태그 없는 순수 번역문. 다른 곳에서 참조하지 않고 그대로 표시만 함
3. **홍T/구문분석/Preview**: 별도 프롬프트를 사용하므로 영향 범위 밖
4. **품질**: 종결 스타일 지정은 오히려 일관성을 높여서 품질 향상에 도움

## 변경 내용

### `supabase/functions/engine/index.ts` — KOREAN TRANSLATION RULES 섹션에 추가

현재 line 156~161의 규칙 블록 끝에 종결 스타일 규칙 추가:

```text
## KOREAN TRANSLATION RULES
- NEVER use Chinese characters (漢字/Hanja) in Korean translations.
- Write all Korean in pure Hangul only.
- Do NOT add parenthetical Hanja explanations like 현현(顯現).
- Use simple, natural Korean words appropriate for middle/high school students.
- 직역(korean_literal_tagged)과 의역(korean_natural) 모두 반말 종결(~했다, ~이다, ~한다, ~였다)로 통일할 것.
- 금지 패턴: ~합니다, ~됩니다, ~했습니다, ~입니다 (존댓말 금지)
- Good 직역: "연구자들은 그 효과를 연구했다"
- Bad 직역: "연구자들은 그 효과를 연구했습니다"
- Good 의역: "이 실험은 보상이 의사결정에 미치는 영향을 보여준다"
- Bad 의역: "이 실험은 보상이 의사결정에 미치는 영향을 보여줍니다"
```

### 수정 파일
- `supabase/functions/engine/index.ts` 1개 (프롬프트 규칙 추가만)

