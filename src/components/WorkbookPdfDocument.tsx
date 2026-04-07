import {
  Document,
  Font,
  Line,
  Page,
  Svg,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

Font.register({
  family: "Pretendard",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-SemiBold.otf",
      fontWeight: 600,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf",
      fontWeight: 700,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

interface SentenceResult {
  id: number;
  original: string;
}

interface ExamBlock {
  topic?: string;
  title?: string;
  one_sentence_summary?: string;
}

interface WorkbookPdfDocumentProps {
  results: SentenceResult[];
  title: string;
  examBlock?: ExamBlock | null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 24,
    paddingLeft: 30,
    paddingRight: 30,
    fontFamily: "Pretendard",
    flexDirection: "column",
  },
  body: {
    flexGrow: 1,
    position: "relative",
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "#222",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  gridLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  gridSvg: {
    width: "100%",
    height: "100%",
  },
  contentLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: 18,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10,
  },
  textLayer: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 6,
    marginBottom: 0,
  },
  title: {
    fontSize: 8,
    fontWeight: 700,
    color: "#111",
  },
  arcLetterBase: {
    position: "absolute" as const,
    fontFamily: "Helvetica",
    fontSize: 7.5,
    fontWeight: 700,
    color: "#111",
  },
  sentenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  sentenceRowCompact: {
    marginBottom: 11,
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginTop: 0,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: "Helvetica",
    color: "#fff",
    fontSize: 6.3,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  sentenceText: {
    fontFamily: "Helvetica",
    flex: 1,
    fontSize: 9.5,
    fontWeight: 600,
    color: "#111",
    lineHeight: 3.5,
  },
  sentenceTextCompact: {
    fontSize: 9.2,
    lineHeight: 3.0,
  },
  analysisSection: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  analysisItem: {
    marginBottom: 13.5,
  },
  analysisBar: {
    position: "absolute",
    left: 0,
    // Trim line-box padding so the bar visually aligns to text top/bottom.
    top: 1.5,
    bottom: 1.5,
    width: 2,
    backgroundColor: "#111",
  },
  analysisContentWrap: {
    position: "relative",
    paddingLeft: 9,
  },
  analysisLabel: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    fontWeight: 800,
    color: "#111",
    letterSpacing: 0.3,
    lineHeight: 1.2,
    marginBottom: 1.5,
  },
  analysisText: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    fontWeight: 400,
    color: "#111",
    lineHeight: 1.6,
  },
});

// Arc text: position each letter of "WORKBOOK" along a curve at top-right corner
// Arc text: position each letter of "WORKBOOK" along a curve outside the body's top-right corner
// Coordinates are in PAGE space (not body-relative)
function getArcLetters() {
  const text = "WORKBOOK";
  // Body starts at paddingLeft=30, width=535, borderRadius=18
  // Top-right corner curve center in page coords: (30 + 535 - 18, headerHeight + 18)
  // Header is ~20pt tall (title fontSize 8 + paddingBottom 6 + marginBottom ~6)
  const cx = 547;  // 30 + 535 - 18
  const cy = 50;   // approximate header height + borderRadius
  const radius = 32; // outside the 18pt corner
  const startAngle = -80; // degrees (near top)
  const endAngle = 0;     // degrees (right side)
  const letters = text.split("");
  const totalAngle = endAngle - startAngle;
  const step = totalAngle / (letters.length - 1);

  return letters.map((char, i) => {
    const angleDeg = startAngle + i * step;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    const rotation = angleDeg + 90;
    return { char, x, y, rotation };
  });
}

export function WorkbookPdfDocument({ results, title, examBlock }: WorkbookPdfDocumentProps) {
  const topic = (examBlock?.topic || "").trim();
  const heading = (examBlock?.title || "").trim();
  const summary = (examBlock?.one_sentence_summary || "").trim();
  const hasAnalysis = Boolean(topic || heading || summary);
  const totalChars = results.reduce((acc, cur) => acc + (cur.original?.length || 0), 0);
  const gridStep = 22;
  const gridStart = -22;
  const gridWidth = 560;
  const gridHeight = 740;
  const horizontalLines = Array.from(
    { length: Math.floor((gridHeight - gridStart) / gridStep) + 2 },
    (_, i) => gridStart + i * gridStep
  );
  const verticalLines = Array.from(
    { length: Math.floor((gridWidth - gridStart) / gridStep) + 2 },
    (_, i) => gridStart + i * gridStep
  );
  const useCompactSentenceLayout = hasAnalysis && (results.length >= 9 || totalChars > 980);
  const sentenceBottomPad = hasAnalysis ? 185 : 0;
  const arcLetters = getArcLetters();

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.gridLayer}>
            <Svg style={styles.gridSvg} viewBox={`0 0 ${gridWidth} ${gridHeight}`} preserveAspectRatio="none">
              {horizontalLines.map((y) => (
                <Line
                  key={`h-${y}`}
                  x1={0}
                  y1={y}
                  x2={gridWidth}
                  y2={y}
                  stroke="#cfcfcf"
                  strokeWidth={0.4}
                  strokeDasharray="3.2 5.2"
                />
              ))}
              {verticalLines.map((x) => (
                <Line
                  key={`v-${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={gridHeight}
                  stroke="#cfcfcf"
                  strokeWidth={0.4}
                  strokeDasharray="3.2 5.2"
                />
              ))}
            </Svg>
          </View>

          {/* Curved "WORKBOOK" text layer - between grid and content */}
          {arcLetters.map((letter, i) => (
            <Text
              key={`arc-${i}`}
              style={[
                styles.arcLetterBase,
                {
                  left: letter.x,
                  top: letter.y,
                  transform: `rotate(${letter.rotation}deg)`,
                },
              ]}
            >
              {letter.char}
            </Text>
          ))}

          <View style={styles.contentLayer}>
            <View style={[styles.textLayer, { paddingBottom: sentenceBottomPad }]}>
              {results.map((result, index) => (
                <View
                  key={result.id}
                  style={[
                    styles.sentenceRow,
                    useCompactSentenceLayout ? styles.sentenceRowCompact : null,
                  ]}
                  wrap={false}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                  <Text
                    style={[
                      styles.sentenceText,
                      useCompactSentenceLayout ? styles.sentenceTextCompact : null,
                    ]}
                  >
                    {result.original}
                  </Text>
                </View>
              ))}
            </View>

            {hasAnalysis && (
              <View style={styles.analysisSection}>
                {topic ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>TOPIC</Text>
                      <Text style={styles.analysisText}>{topic}</Text>
                    </View>
                  </View>
                ) : null}
                {heading ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>TITLE</Text>
                      <Text style={styles.analysisText}>{heading}</Text>
                    </View>
                  </View>
                ) : null}
                {summary ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>SUMMARY</Text>
                      <Text style={styles.analysisText}>{summary}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
