

## Preview 어휘 확장 + 복붙 추가 기능

### 개요
- 단어 최대 30→40개로 확장
- 외부에서 정리한 단어(품사 포함)를 복붙하면 AI가 기존 틀(word/pos/meaning_ko/in_context)에 맞춰 정리
- 기존 3열 테이블 디자인 유지, 열당 행수만 조정

### 변경 파일

**1. 새 Edge Function: `supabase/functions/parse-vocab-paste/index.ts`**
- 입력: `{ raw_text, passage, existing_words[] }`
- AI가 붙여넣은 텍스트(단어+품사 포함)를 파싱하여 기존 품사 체계(동/명/형/부/접/전)로 변환
- 출력: `VocabItem[]` (word, pos, meaning_ko, in_context)
- 이미 존재하는 단어 제외
- 모델: `google/gemini-2.5-flash`

**2. 새 컴포넌트: `src/components/preview/VocabPasteDialog.tsx`**
- Dialog에 textarea → "정리하기" 버튼 → AI 호출 → 결과 미리보기 → "추가" 버튼으로 vocab에 append
- 40개 초과 시 경고

**3. `PreviewVocabSection.tsx`**
- `TOTAL_SLOTS` 30→40, 카운터 `/40`
- 3열: 14/13/13행으로 분배
- 헤더에 "붙여넣기" 버튼 추가
- 긴 단어 대응: word 열에 `truncate` 처리

**4. `Preview.tsx`**
- `count: 30` → `count: 40`
- `handleBulkAdd` 콜백 추가 (최대 40개 제한)

**5. `PreviewPdf.tsx`**
- 3열 유지, 각 열 14/13/13 슬롯으로 변경

**6. `supabase/config.toml`**
- `parse-vocab-paste` 함수 등록 (`verify_jwt = false`)

