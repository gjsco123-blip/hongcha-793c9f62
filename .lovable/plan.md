

## PDF 동사 밑줄 앞 공백 문제 해결

### 원인 분석

`@react-pdf/renderer`에서는 `<Text>` 내부에 자식 `<Text>`를 넣을 때, 공백용 `<Text> </Text>`와 밑줄 적용된 `<Text>`가 연속으로 오면 **공백이 밑줄 텍스트 앞에 붙어서 렌더링**되는 경우가 있습니다. 이는 react-pdf의 텍스트 레이아웃 특성 때문입니다.

### 해결 방법

공백을 밑줄이 없는 단어에 **접미사**로 붙이는 방식으로 변경합니다. 즉, 동사 단어 앞에 공백을 넣는 대신, **이전 단어 뒤에** 공백을 붙입니다.

### 변경 파일

**src/components/PdfDocument.tsx** - `renderChunksWithVerbUnderline` 함수 수정

현재 (문제 있는 코드):
```jsx
words.forEach((w, wi) => {
  if (wi > 0) {
    elements.push(<Text key={...}> </Text>);  // 별도 공백 Text
  }
  elements.push(
    <Text key={...} style={w.isVerb ? styles.verbUnderline : undefined}>
      {w.word}
    </Text>
  );
});
```

변경 후:
```jsx
words.forEach((w, wi) => {
  const prefix = wi > 0 ? ' ' : '';
  if (w.isVerb) {
    // 동사일 때: 공백은 스타일 없는 Text로, 단어는 밑줄 Text로 분리
    if (prefix) {
      elements.push(<Text key={`${ci}-${wi}-sp`}>{prefix}</Text>);
    }
    elements.push(
      <Text key={`${ci}-${wi}`} style={styles.verbUnderline}>
        {w.word}
      </Text>
    );
  } else {
    // 비동사일 때: 공백을 단어와 합쳐서 하나의 Text로
    elements.push(
      <Text key={`${ci}-${wi}`}>
        {prefix}{w.word}
      </Text>
    );
  }
});
```

핵심: 비동사 단어는 공백과 합쳐서 하나의 `<Text>`로 렌더링하고, 동사 단어만 공백을 별도 `<Text>`로 분리합니다. 이렇게 하면 react-pdf가 공백을 동사 밑줄에 포함시키지 않습니다.

### 기술 요약

| 파일 | 변경 |
|------|------|
| src/components/PdfDocument.tsx | 비동사 단어는 앞 공백과 합쳐서 1개 Text로, 동사 단어는 앞 공백 분리 |

