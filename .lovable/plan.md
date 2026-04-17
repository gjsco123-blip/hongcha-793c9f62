

# analyze-preview 모델 업그레이드 — gemini-3.1-pro-preview

## 수정 파일
`supabase/functions/analyze-preview/index.ts` (1줄 변경)

## 변경 내용

`callAi` 함수 내부 `model` 필드만 교체:

```ts
// Before
model: "google/gemini-3-flash-preview",

// After
model: "google/gemini-3.1-pro-preview",
```

그 외 모든 로직 유지:
- 시스템 프롬프트 (CRITICAL LENGTH RULE, Few-shot, Self-check) 그대로
- 후처리 안전망 (`summaryHasOutOfRangeLine` 45~58자 검증, 1회 재요청) 그대로
- 429 처리, JSON 파싱 등 모든 안정성 로직 그대로

## 영향 범위 / 안 건드리는 것

**영향**: Preview 페이지의 초기 분석 + Topic/Title/Summary/Passage Logic 재생성  
**미변경**:
- `engine`, `hongt`, `grammar`, `analyze-vocab`, `analyze-synonyms` 등 모든 다른 엣지 함수 → flash-preview 유지
- 프론트엔드 코드 전혀 변경 없음
- 프롬프트 변경 없음

## 기대 효과

1. **길이 강제 추종성 향상**: Pro 모델은 "45~58자" 같은 수치 규칙을 flash보다 잘 지킴 → 자동 재요청 발동 빈도 감소
2. **압축 편향 완화**: 재생성 시 "더 짧게 = 더 좋게" 편향이 약해짐
3. **한국어 명사형 종결의 자연스러움 향상**

## 트레이드오프

- **응답 속도**: 약 1.5~2배 느려짐 (지문당 수 초 추가)
- **비용**: 호출당 단가 상승 (단, 호출 빈도 낮은 함수라 총비용 영향 작음)
- **호출 빈도**: 지문 1개당 초기 1회 + 사용자 재생성 시. 폭발적이지 않음 → 감수 가능

## 롤백
1줄만 바꾸므로, 문제 시 `gemini-3-flash-preview`로 즉시 복귀 가능.

## 배포
`analyze-preview` 함수 재배포 1회.

