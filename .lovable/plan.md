
## Preview PDF를 웹 화면과 동일한 구조로 변경

### 현재 문제
- **웹 UI**: 단일 컬럼, 세로 배치 (Vocabulary → Key Summary → Structure → Topic/Title/Summary)
- **PDF**: 2단 레이아웃, 상단에 Topic/Title/Summary 헤더, 좌측 Key Summary+Structure, 우측 Vocabulary
- 순서와 레이아웃이 완전히 다름

### 변경 계획

**`src/components/PreviewPdf.tsx` 전면 재구성:**

1. **2단 레이아웃 제거** -- 웹과 동일한 단일 컬럼 세로 배치로 변경
2. **섹션 순서를 웹과 동일하게 정렬:**
   - Vocabulary (2열 테이블, 1-10 / 11-20 나란히)
   - Key Summary (왼쪽 세로 바 + 3줄)
   - Structure (번호 + 한국어 한 줄씩)
   - Topic / Title / Summary (각각 라벨 + 영어 + 한국어 해석)
3. **Topic/Title/Summary 스타일링:**
   - 영어: 기본 크기 (9pt)
   - 한국어: 85-90% 크기 (7.5pt), 연한 색상
   - Title만 볼드 + 약간 큰 크기
4. **섹션 구분**: 얇은 구분선 (0.5pt) 으로 각 섹션 분리
5. **Vocabulary 테이블**: 웹과 동일하게 좌우 2열 (1-10, 11-20), 헤더 포함

### 기술 세부사항

- 폰트: Pretendard(한글) + Source Serif 4(영문) 유지
- 본문 8-9pt, 보조 7-7.5pt
- lineHeight 1.6-1.8
- 여백 좌우 36pt 유지
- 빈 섹션은 숨김 처리 유지
- 어휘 20개 미만 경고 유지

### 수정 파일
- `src/components/PreviewPdf.tsx` -- 전면 재작성 (단일 컬럼, 웹 순서)
