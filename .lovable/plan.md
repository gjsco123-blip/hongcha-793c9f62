

# 핵심 엔진 3개 모델 → gemini-3.1-pro-preview 업그레이드

## 현재 → 변경

| 함수 | 현재 모델 | 변경 후 |
|------|----------|---------|
| `engine` (메인 엔진) | `gemini-3-flash-preview` | `gemini-3.1-pro-preview` |
| `analyze-structure` (구조 분석) | `gemini-2.5-flash` | `gemini-3.1-pro-preview` |
| `analyze-preview` (Preview 분석) | `gemini-3-flash-preview` | `gemini-3.1-pro-preview` |

## 변경 내용
각 파일에서 `model:` 값 한 줄만 교체. 프롬프트·로직 변경 없음.

### 수정 파일
1. `supabase/functions/engine/index.ts` — line 222
2. `supabase/functions/analyze-structure/index.ts` — line 78
3. `supabase/functions/analyze-preview/index.ts` — line 196

## 나머지 함수는 유지
홍T, 구문분석, 어휘, 채팅 등은 `gemini-3-flash-preview` 그대로 유지 (속도 우선).

## 리스크
없음. 모델명만 변경, 프롬프트 호환성 문제 없음. 응답 시간은 Pro 계열이라 약간 느려질 수 있으나 품질 향상이 더 큼.

