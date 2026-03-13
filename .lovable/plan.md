

# Topic 첫 글자 대문자 처리

## 변경 내용

AI가 topic을 소문자로 반환하는 경우가 많으므로, topic 값이 설정/업데이트되는 모든 지점에서 첫 글자를 대문자로 변환합니다.

### 1. Preview 페이지 데이터 수신 시 (`src/pages/Preview.tsx`)
- `analyze-preview` 응답을 받아 `examBlock`에 저장할 때, `topic` 첫 글자를 대문자로 변환
- regenerate topic 결과에도 동일 적용

### 2. PDF 렌더러 (`src/components/PreviewPdf.tsx`)
- `examBlock.topic` 출력 시 첫 글자 대문자 보장

### 3. 웹 UI (`src/components/preview/PreviewExamSection.tsx`)
- `examBlock.topic` 표시 시 첫 글자 대문자 보장

### 구현 방식
유틸 함수 하나로 처리:
```typescript
function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
```

데이터 저장 시점(Preview.tsx)에서 적용하면 웹/PDF 모두 자동 반영되므로, Preview.tsx의 examBlock 설정 부분에만 적용하는 것이 가장 효율적입니다.

### 수정 파일
- `src/pages/Preview.tsx` — topic 저장 시 `capitalizeFirst` 적용 (2~3곳)

