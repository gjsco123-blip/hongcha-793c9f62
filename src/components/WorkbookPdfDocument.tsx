import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

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
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 0.8,
    borderBottomColor: "#111",
    paddingBottom: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111",
  },
  workbookLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: "#111",
    letterSpacing: 0.6,
  },
  sentenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginTop: 1,
    flexShrink: 0,
  },
  badgeText: {
    color: "#fff",
    fontSize: 6.8,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  sentenceText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: 600,
    color: "#111",
    lineHeight: 2.5,
  },
  analysisSection: {
    marginTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: "#111",
    paddingTop: 8,
  },
  analysisHeader: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#666",
    marginBottom: 6,
  },
  analysisItem: {
    marginBottom: 5,
  },
  analysisLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#666",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  analysisText: {
    fontSize: 8.5,
    fontWeight: 400,
    color: "#111",
    lineHeight: 1.5,
  },
});

export function WorkbookPdfDocument({ results, title, examBlock }: WorkbookPdfDocumentProps) {
  const topic = (examBlock?.topic || "").trim();
  const heading = (examBlock?.title || "").trim();
  const summary = (examBlock?.one_sentence_summary || "").trim();
  const hasAnalysis = Boolean(topic || heading || summary);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.workbookLabel}>Workbook</Text>
        </View>

        {results.map((result, index) => (
          <View key={result.id} style={styles.sentenceRow} wrap={false}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{String(index + 1).padStart(2, "0")}</Text>
            </View>
            <Text style={styles.sentenceText}>{result.original}</Text>
          </View>
        ))}

        {hasAnalysis && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisHeader}>TOPIC / TITLE / SUMMARY</Text>
            {topic ? (
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>TOPIC</Text>
                <Text style={styles.analysisText}>{topic}</Text>
              </View>
            ) : null}
            {heading ? (
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>TITLE</Text>
                <Text style={styles.analysisText}>{heading}</Text>
              </View>
            ) : null}
            {summary ? (
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>SUMMARY</Text>
                <Text style={styles.analysisText}>{summary}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Page>
    </Document>
  );
}
