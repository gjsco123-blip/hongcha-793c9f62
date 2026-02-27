

## 제목 왼쪽 세로 액센트 바 추가

**파일:** `src/components/PdfDocument.tsx`

### 변경 내용

1. **헤더 JSX 수정** (486-489줄): 제목+subtitle을 `flexDirection: "row"` 레이아웃으로 감싸고, 왼쪽에 세로 바 추가

```jsx
<View style={{ flexDirection: "row", alignItems: "stretch" }}>
  <View style={{ width: 3, backgroundColor: "#222", marginRight: 10, borderRadius: 1 }} />
  <View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </View>
</View>
```

- 세로 바: 너비 3pt, 색상 `#222`, 제목+subtitle 높이에 맞춰 자동 stretch
- 바와 텍스트 간격: 10pt

