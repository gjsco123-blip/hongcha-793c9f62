
## 문장 분리 방식 선택 기능 추가

### 현재 문제

현재 `splitIntoSentences` 함수가 정규식 `/(?<=[.!?])\s+/`를 사용하여 문장을 분리하는데, 인용문 안의 마침표(`this." Marcus`)나 복잡한 문장 구조에서 제대로 분리되지 않음.

---

### 해결 방안: 3가지 분리 모드 제공

| 모드 | 설명 | 사용 시점 |
|------|------|----------|
| **자동** | 기존 정규식 사용 (`.!?` 뒤 공백) | 일반적인 지문 |
| **줄바꿈** | Enter로 구분 | 수동으로 문장 분리할 때 |
| **구분자** | 사용자 지정 구분자 (예: `|||`) | 정밀한 분리가 필요할 때 |

---

### UI 디자인

```text
┌─────────────────────────────────────────┐
│ [영어 지문 입력...]                      │
│                                         │
└─────────────────────────────────────────┘
분리: [자동 ▾] [줄바꿈] [구분자: |||]     3개 문장
                                    [분석하기]
```

- 텍스트 입력창 아래에 토글 버튼 그룹으로 분리 모드 선택
- "구분자" 선택 시 입력 필드 표시

---

### 구현 계획

#### 1. 상태 추가

```typescript
type SplitMode = "auto" | "newline" | "delimiter";

const [splitMode, setSplitMode] = useState<SplitMode>("auto");
const [customDelimiter, setCustomDelimiter] = useState("|||");
```

#### 2. 분리 함수 수정

```typescript
function splitIntoSentences(text: string, mode: SplitMode, delimiter: string): string[] {
  switch (mode) {
    case "newline":
      return text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
    case "delimiter":
      return text.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
    case "auto":
    default:
      return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  }
}
```

#### 3. UI 컴포넌트 추가

텍스트 입력창 아래에 분리 모드 선택 버튼 그룹:
- 3개의 토글 버튼: 자동 / 줄바꿈 / 구분자
- 구분자 모드 선택 시 구분자 입력 필드 표시

---

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| src/pages/Index.tsx | 1. `SplitMode` 타입 및 상태 추가<br>2. `splitIntoSentences` 함수 수정<br>3. 분리 모드 선택 UI 추가 |

---

### 예상 결과

- 사용자가 복잡한 문장 구조에서도 수동으로 줄바꿈이나 구분자를 사용하여 정확하게 문장 분리 가능
- 기존 자동 분리도 그대로 사용 가능
