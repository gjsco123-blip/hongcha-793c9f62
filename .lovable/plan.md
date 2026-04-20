

## PDF 슬래시 간격 2.5/2.5로 조정

### 변경 내용
**파일:** `src/components/PdfDocument.tsx`

현재:
```tsx
chunkSlash: {
  fontFamily: "Pretendard",
  fontWeight: 600,
  fontSize: 9.5,
  lineHeight: 2.5,
  marginLeft: 4,
  marginRight: 4,
},
```

변경:
```tsx
chunkSlash: {
  fontFamily: "Pretendard",
  fontWeight: 600,
  fontSize: 9.5,
  lineHeight: 2.5,
  marginLeft: 2.5,
  marginRight: 2.5,
},
```

### 검증 포인트
1. 슬래시 앞뒤 간격이 더 촘촘해졌는지 확인
2. S/V 라벨 위치 변화 없는지 확인
3. 줄바꿈 시 슬래시가 어색하게 밀리지 않는지 확인

