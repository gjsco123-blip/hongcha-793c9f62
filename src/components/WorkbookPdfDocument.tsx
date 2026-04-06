import {
  Document,
  Font,
  Image,
  Page,
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
  },
  gridLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  gridSvg: {
    width: "100%",
    height: "100%",
  },
  contentLayer: {
    position: "absolute",
    top: 18,
    right: 10,
    bottom: 10,
    left: 10,
    zIndex: 2,
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
  workbookLabel: {
    fontFamily: "Helvetica",
    fontSize: 16,
    fontWeight: 800,
    color: "#111",
    letterSpacing: 0.6,
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
    marginTop: "auto",
    paddingTop: 6,
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

export function WorkbookPdfDocument({ results, title, examBlock }: WorkbookPdfDocumentProps) {
  const topic = (examBlock?.topic || "").trim();
  const heading = (examBlock?.title || "").trim();
  const summary = (examBlock?.one_sentence_summary || "").trim();
  const hasAnalysis = Boolean(topic || heading || summary);
  const totalChars = results.reduce((acc, cur) => acc + (cur.original?.length || 0), 0);
  const gridStep = 22;
  const gridWidth = 560;
  const gridHeight = 740;
  const gridSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${gridWidth}" height="${gridHeight}" viewBox="0 0 ${gridWidth} ${gridHeight}">
  <defs>
    <pattern id="grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse">
      <path d="M 0 0 H ${gridStep} M 0 0 V ${gridStep}"
            fill="none"
            stroke="#cfcfcf"
            stroke-width="0.45"
            stroke-dasharray="1.2 3.6"
            stroke-linecap="round"
            shape-rendering="geometricPrecision" />
    </pattern>
  </defs>
  <rect x="0" y="0" width="${gridWidth}" height="${gridHeight}" fill="url(#grid)" />
</svg>`;
  // Use URI-encoded SVG (instead of runtime base64 conversion) for stable rendering in react-pdf.
  const gridDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(gridSvg)}`;
  // Keep the requested default (3.5/15), but compact automatically on dense pages
  // so the bottom analysis block is less likely to move to the next page.
  const useCompactSentenceLayout = hasAnalysis && (results.length >= 9 || totalChars > 980);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.workbookLabel}>WORKBOOK</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.gridLayer}>
            <Image src={gridDataUri} style={styles.gridSvg} />
          </View>

          <View style={styles.contentLayer}>
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
