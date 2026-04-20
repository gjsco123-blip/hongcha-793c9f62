

## 주어 밑줄이 안 보이는 원인 분석 및 수정 플랜

### 현상
- 관리자 플래그 ON, 새로 분석까지 했는데도 주어 밑줄이 안 보임

### 원인 후보 조사 필요
1. **엔진이 `<s>` 태그를 실제로 출력하고 있는가?** — DB의 최근 `results_json` 확인 필요
2. **렌더링 측에서 `isSubject` segment를 제대로 그리는가?** — `ResultDisplay.tsx` 확인 필요
3. **`parseTaggedSegments`가 `<s>`를 제대로 파싱하는가?** — `chunk-utils.ts` 확인
4. **flag가 실제로 ON 상태로 읽히는가?** — `feature_flags` 테이블 확인

### 조사 단계
1. `feature_flags` 테이블에서 `subject_underline` 행 상태 확인
2. 최근 분석된 `passages.results_json`에 `<s>` 태그가 있는지 확인
3. `ResultDisplay.tsx`에서 주어 밑줄 렌더 로직 확인
4. `engine/index.ts` 프롬프트가 `<s>` 규칙을 실제 포함하는지 확인

### 예상 수정
- **A안**: 엔진이 `<s>` 안 찍는 경우 → 프롬프트 강화 + few-shot 보강 + 검증 단계 추가
- **B안**: 렌더링 누락 → `ResultDisplay`/`PdfDocument`에 flag+isSubject 분기 추가
- **C안**: `parseTaggedSegments`가 `<s>` 못 파싱 → 정규식 수정

플랜 승인 후 위 4가지 조사 → 원인 특정 → 해당 수정 1~2파일만 수술적으로 적용

