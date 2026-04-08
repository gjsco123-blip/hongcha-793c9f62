
내가 이해한 목표

- 외곽선과 글자 검은 외곽 사이 간격은 “아주 살짝만”.
- `R`의 현재 gap을 기준점으로 고정.
- 이번엔 `baseOffset`, spacing, 회전 공식은 건드리지 않고, 문제로 보이는 글자만 보정.
- 핵심은 `W O R`를 흔들지 않고 `O(left of R)`와 `K B O O K`를 `R` gap에 맞추는 것.

현재 문제점

- 전역 수학 문제는 거의 정리됐고, 지금 남은 건 `LETTER_METRICS.borderPush` 불균형이야.
- 현재 값:
  - `O(left)` = `0.4` → 과보정이라 border에 거의 붙어 보임
  - `K/B/O/O/K` = `0 / 0.3 / 0.4 / 0.4 / 0` → 우측/곡선 기준으로는 부족해서 `R`보다 점점 멀어 보임
- 즉 지금 실패 원인은 `R` 기준 optical gap이 아니고,
  - 왼쪽 `O`는 너무 많이 밀렸고
  - 오른쪽 `K B O O K`는 덜 밀린 상태야.
- 그래서 지금 문제는 `baseOffset`도 아니고 회전 공식도 아니고, 사실상 `borderPush` 튜닝 하나로 좁혀졌어.

구현 계획

1. `src/components/WorkbookPdfDocument.tsx`의 `LETTER_METRICS`만 수정
   - 유지: `W`, `R`, `baseOffset`, anchor 공식
   - 수정 대상: `index 1 O`, `index 3~7 KBOOK`

2. 조정 방향
   - `O(left)`는 현재보다 낮춤: `0.4 -> 약 0.2~0.25`
   - `K(corner)`는 소폭 올림: `0 -> 약 0.2~0.3`
   - `B`는 확실히 올림: `0.3 -> 약 0.7~0.8`
   - `O/O(right)`는 더 올림: `0.4 -> 약 0.85~1.0`
   - 마지막 `K`도 0이 아니라 소폭 올림: `0 -> 약 0.25~0.35`

3. 원칙
   - `R` gap을 절대 기준으로 삼고 다른 글자가 그 gap에 “같아 보이게” optical tuning
   - 간격/경로/회전은 고정해서, 실패 원인을 `borderPush` 하나로만 통제

검증 계획

- 구현 후 실제 PDF 렌더 결과로만 확인
- 확인 기준:
  1. `O(left)`가 더 이상 border에 붙어 보이지 않을 것
  2. `K → B → O → O → K`가 오른쪽으로 갈수록 멀어지는 느낌이 사라질 것
  3. 모든 글자가 `R`와 같은 “아주 작은 gap”으로 보일 것
  4. border와 겹치지는 않을 것

기술 메모

- 수정 위치: `LETTER_METRICS` (현재 약 199~207행)
- export는 `usePdfExport` / `useBatchPdfExport` 모두 같은 `WorkbookPdfDocument`를 사용하므로, 이 파일만 맞추면 실제 PDF도 같이 맞춰짐
- 이번엔 구조를 또 바꾸는 단계가 아니라, `R` 기준 optical calibration의 마지막 단계라고 보면 돼
