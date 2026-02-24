

## 문제 원인

`@react-pdf/renderer`는 인라인 `<Text>`에 `transform`, `marginTop`을 **무시**합니다. 그래서 아무리 값을 바꿔도 위첨자가 올라가지 않았습니다.

그런데 같은 파일 199~205줄의 `passageNumber` 스타일을 보면:
```
passageNumber: {
  fontWeight: 600,
  fontSize: 5,
  verticalAlign: "super",  // ← 이게 동작함
  marginRight: 2,
  color: "#000",
},
```
이 스타일은 TEXT ANALYSIS 섹션에서 정상적으로 위첨자가 올라갑니다.

**차이점**: `passageNumber`는 `verticalAlign: "super"`만 쓰고 일반 숫자를 출력합니다. 현재 `supStyle`은 유니코드 위첨자(¹²³) + `transform`을 조합하는데, transform이 무시되니 유니코드 위첨자가 기본 위치(베이스라인)에 그냥 찍히는 것입니다.

## 수정 계획

**`supStyle`을 `passageNumber`와 동일한 방식으로 변경:**

- `verticalAlign: "super"` 사용 (react-pdf가 실제로 지원하는 속성)
- 유니코드 위첨자(⁰¹²...) 대신 **일반 숫자** 출력 (`verticalAlign`이 올려주므로)
- `transform`, `lineHeight: 1` 제거

```typescript
// 변경 전 (line 249)
const supStyle = { fontSize: 5, lineHeight: 1, transform: "translateY(-3.2)" as const };

// 변경 후
const supStyle = { fontSize: 5, verticalAlign: "super" as const };
```

```typescript
// renderSup에서 유니코드 위첨자 대신 일반 숫자 출력
const renderSup = (key: string, id: number) => (
  <Text key={key} style={supStyle}>
    {String(id)}
  </Text>
);
```

`toSuperscriptNumber` 헬퍼 함수는 더 이상 사용되지 않으므로 제거합니다.

## 변경 파일
- `src/components/PdfDocument.tsx` — supStyle + renderSup 수정, toSuperscriptNumber 제거

