

## 주어(S) 표시 — 최종 통합 플랜 (Feature Flag 보호)

### 결정사항 총정리
1. **범위**: **옵션 A** — 핵심 명사구만 (한정사 + 전위 형용사 + 핵 명사). 후치 수식어구 제외 → 수일치 핵 식별 목적
2. **종속절 내부 주어도 표시**
3. **삽입구 제외** (`The students, however, are...` → `students`만)
4. **시각 스타일**: 동사와 동일한 실선 밑줄
5. **There/Here 구문**: `there/here`는 제외, **동사 뒤 명사구 핵**을 `<s>`로
6. **가주어 It**: `It`을 `<s>`로 (진주어가 절이라 명사구 핵 없음)
7. **Feature flag로 보호**: `subject_underline`

### Feature Flag
- **Key**: `subject_underline`
- **설명**: "주어(S) 핵심 명사구에 동사와 동일한 밑줄 표시 (베타)"
- **초기값**: `enabled_for_admin=false`, `enabled_for_all=false` → 배포 후 /admin에서 수동 활성화

### 변경 파일 (5개 + DB)

**1. DB 마이그레이션**
- `feature_flags`에 `subject_underline` 행 INSERT

**2. `src/lib/chunk-utils.ts`**
- `ChunkSegment`에 `isSubject?: boolean` 추가
- `parseVerbSegments` → `parseTaggedSegments`로 확장: `<v>`와 `<s>` 둘 다 파싱
  - 중첩 불가 가정 (엔진이 두 태그를 겹쳐 출력하지 않음 — 프롬프트로 강제)
  - 잔여 태그 제거 정규식에 `<\/?s>` 추가
- `chunksToTagged`: segment에서 `isVerb` → `<v>`, `isSubject` → `<s>` 복원
- `segmentsToWords` / `wordsToSegments`: `isSubject` 전파
- `parseTagged`의 `cleanText` / orphan 정리 정규식에 `<\/?s>` 추가

**3. `supabase/functions/engine/index.ts`**
- 청킹 프롬프트에 `<s>` 규칙 추가:
  - 핵심 NP만 (한정사 + 전위 형용사 + 핵 명사, 등위 주어 `A and B`는 핵 단위 포함)
  - 후치 수식 제외 (전치사구/관계절/분사구/동격)
  - 종속절 내부 finite 동사의 주어도 태깅
  - 삽입구는 `<s>` 안 미포함
  - `There/Here + be + NP` → 동사 뒤 NP 핵을 `<s>`
  - 가주어 `It`은 `<s>`
  - `<v>`와 `<s>`는 절대 겹치지 않음 (인접만 허용)
- few-shot 예시 6개 추가 (각 케이스별)
- 검증 단계: `<s>` 누락 시 1회 재시도 (verb verification 패턴 참조)

**4. 렌더링 (모두 flag 체크)**
- `src/components/PdfDocument.tsx` — `useFeatureFlag('subject_underline')` 후 `isSubject` segment에 동사와 동일한 밑줄 클래스
- `src/components/ResultDisplay.tsx` — flag 체크 후 동일 적용 (`mergeAdverbsBetweenVerbs`와 충돌 없음 — 주어/동사는 별도 segment)
- `src/components/WorkbookPdfDocument.tsx` — flag 체크 후 동일 적용

### 잠재 오류 점검 (이번에 새로 확인)

**오류 1: superscript 매핑 깨짐 가능성**
- 현재 `mergeAdverbsBetweenVerbs`는 `indexMap`을 만들어 superscript anchor 인덱스 재매핑
- `<s>` 추가로 segment 개수가 늘면 기존 anchor 인덱스가 밀림
- **해결**: superscript는 **단어 토큰 기준**(`findTargetSpan`)으로 동작하므로 segment 개수 변화에 영향 없음 (메모리 `mem://features/syntax-superscripts` 확인). 안전.

**오류 2: 기존 저장 데이터 호환성**
- 저장된 `results_json`에는 `<s>` 없음
- `parseTaggedSegments`가 `<s>` 없는 raw text도 정상 파싱해야 함 → 기존 `<v>` 처리 패턴과 동일하므로 안전
- Flag OFF면 `isSubject` 무시되어 영향 0

**오류 3: `chunksToTagged` 직렬화 시 태그 순서**
- segment에 `isVerb`와 `isSubject`가 동시에 true가 되면 안 됨
- **해결**: `wordsToSegments` 병합 시 `isVerb`와 `isSubject`를 별도 키로 비교 (한 segment는 둘 중 하나만 true 또는 둘 다 false). 둘이 동시에 true면 직렬화에서 `<s><v>...</v></s>` 같은 중첩 발생 → 엔진 프롬프트에서 "겹치지 않음" 강제로 해결

**오류 4: `mergeAdverbsBetweenVerbs`가 주어 segment를 부사로 오인할 가능성**
- 현재 함수는 `isVerb`만 체크. `isSubject`는 안 봄
- 시나리오: `<v>can</v><s>now</s><v>be</v>` 같은 비정상 출력 시 `now`(isSubject)가 부사 취급 안 됨 → 병합 안 됨 → 분리 표시 (안전한 fallback)
- 정상 케이스에서는 주어와 동사 사이에 항상 다른 토큰이 있어 영향 없음. 안전.

**오류 5: `parseTagged` orphan 처리에서 `<s>` 잔여**
- orphan 텍스트에서 `<\/?c\d+>`만 제거하고 있음 → `<s>` 잔여물이 본문에 노출될 위험
- **해결**: orphan 정리에 `<\/?s>`와 `<\/?v>` 모두 추가 (이미 `<\/?v>`는 처리됨, `<s>`만 추가)

**오류 6: ChunkEditor의 단어 토글 (verb on/off) 시 `<s>` 손실**
- 더블클릭으로 동사 토글 시 `wordsToSegments`로 재구성 → `isSubject`도 함께 보존되어야 함
- **해결**: `segmentsToWords`/`wordsToSegments`가 `isSubject`도 전파하도록 확장

**오류 7: Flag OFF인 사용자가 새 분석 시 DB에 `<s>` 태그가 저장됨**
- 영향 0: flag OFF면 렌더링 단에서 무시. 나중에 flag 켜면 자동 표시
- 오히려 의도된 동작 (점진적 롤아웃 가능)

### 메모리 업데이트
- `mem://features/subject-underline` 신규: 플래그명, 옵션 A 규칙, There/Here/It 처리, 시각 스타일
- `mem://index.md`에 항목 추가

### 검증 케이스 (flag ON)
1. `The new students are confronted...` → `students`만 밑줄 (`The new` 제외 또는 포함? — 옵션 A 정의상 한정사+전위 형용사 포함이므로 **`The new students` 전체** 밑줄)
2. `The students from Seoul who passed are now...` → `The students` 밑줄, 후치 수식 제외
3. `Because the rain stopped, we went out` → `the rain`과 `we` 둘 다 밑줄
4. `The students, however, are confused` → `The students` 밑줄, `however` 제외
5. `It is important that...` → `It` 밑줄
6. `There are many students` → `many students` 밑줄 (there 제외)
7. `Here are the books I bought` → `the books` 밑줄
8. `John and Mary are...` → `John and Mary` 전체 밑줄

### 롤백 전략
- /admin에서 `subject_underline` flag OFF → 즉시 시각만 사라짐, 데이터 유지
- 엔진 프롬프트 롤백 시 신규 분석은 `<s>` 미포함, 기존 분석은 그대로

