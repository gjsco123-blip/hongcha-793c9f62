

## 구문분석 번호 위첨자 표시 기능

### 개요
사용자가 ChunkEditor에서 텍스트를 드래그하여 구문분석을 생성할 때, 해당 구문분석 번호(1, 2, 3...)가 영문 청크 위에 위첨자로 표시되도록 하는 기능입니다.

### 현재 구조 분석

현재 `SyntaxNote`는 `{ id: number, content: string }`만 저장하고 있어, 어떤 텍스트를 선택해서 생성했는지 정보가 없습니다. 위첨자를 표시하려면 "어떤 단어/구문에 몇 번이 달려야 하는지" 알아야 합니다.

### 구현 계획

**1. SyntaxNote 인터페이스 확장** (`src/pages/Index.tsx`)
```typescript
export interface SyntaxNote {
  id: number;
  content: string;
  targetText?: string; // 드래그한 원문 텍스트 (예: "so little variation")
}
```

**2. 선택 텍스트 저장** (`src/pages/Index.tsx` — `handleGenerateSyntax`)
- 수동 모드(selectedText 있을 때): `targetText`에 선택한 텍스트를 함께 저장
- 자동 생성 모드: `targetText` 없이 기존대로 동작 (위첨자 없음)

**3. 웹 UI — 영문 문장에 위첨자 표시** (`src/pages/Index.tsx` 또는 별도 컴포넌트)
- 현재 `result.original`을 단순 텍스트로 렌더하는 부분(line 584-585)을 수정
- `syntaxNotes` 중 `targetText`가 있는 항목들에 대해, 원문에서 해당 텍스트를 찾아 끝 부분에 위첨자 `<sup>` 번호를 삽입
- 매칭은 대소문자 무시, 단어 경계 기준

**4. ChunkEditor 영역에도 위첨자 표시** (`src/components/ChunkEditor.tsx`)
- 청크 표시 영역에서도 해당 단어 위에 작은 위첨자 번호 표시
- `syntaxNotes` prop을 ChunkEditor에 전달 필요

**5. PDF에도 위첨자 반영** (`src/components/PdfDocument.tsx`)
- `renderChunksWithVerbUnderline` 함수에서 `syntaxNotes`의 `targetText`를 매칭하여 위첨자 `<Text>` 추가
- `SentenceResult` 인터페이스에 이미 `syntaxNotes`가 있으므로 데이터 전달은 문제 없음

### 매칭 로직 (핵심)
```
입력: original = "Most humans are genetically very similar and there is so little variation..."
syntaxNotes = [{ id: 1, targetText: "so little variation", content: "..." }]

결과: "Most humans are genetically very similar and there is so little variation¹..."
```

- 원문 텍스트에서 `targetText`의 위치를 찾고, 끝 부분 바로 뒤에 위첨자 번호 삽입
- 여러 구문이 겹칠 수 있으므로 위치 기준 정렬 후 뒤에서부터 삽입

### 복잡도 평가
복잡하지 않습니다. 핵심은:
1. `targetText` 필드 하나 추가 (데이터)
2. 텍스트 매칭 + 위첨자 렌더링 유틸 함수 하나 (로직)
3. 3곳에 적용 (원문 표시, 청크 에디터, PDF)

### 변경 파일
- `src/pages/Index.tsx` — SyntaxNote 타입 확장 + targetText 저장 + 원문에 위첨자 렌더
- `src/components/ChunkEditor.tsx` — syntaxNotes prop 추가, 위첨자 표시
- `src/components/PdfDocument.tsx` — PDF 영문에 위첨자 반영
- `src/hooks/usePdfExport.ts` — SyntaxNote 타입 동기화

