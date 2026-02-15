import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { Chunk, segmentsToWords } from "@/lib/chunk-utils";

Font.register({
  family: "Noto Sans KR",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Pretendard",
  src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf",
});

Font.registerHyphenationCallback((word) => [word]);

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: string;
  hongTNotes?: string;
  hideLiteral?: boolean;
  hideNatural?: boolean;
  hideHongT?: boolean;
}

interface PdfDocumentProps {
  results: SentenceResult[];
  title: string;
  subtitle: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 85,
    paddingLeft: 57,
    paddingRight: 120,
    fontFamily: "Noto Sans KR",
    fontSize: 9,
    lineHeight: 1.8,
  },
  header: {
    marginTop: -14,
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
    marginTop: 4,
  },
  sentenceContainer: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  sentenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 0,
    marginBottom: 6,
  },
  sentenceNumber: {
    fontSize: 8,
    fontWeight: 700,
    width: "auto",
    flexShrink: 6,
    lineHeight: 2.2,
    marginTop: 0,
  },
  englishText: {
    fontFamily: "Pretendard",
    fontSize: 8,
    lineHeight: 2.2,
    flex: 1,
    marginLeft: 6,
  },
  translationContainer: {
    marginLeft: 16,
  },
  translationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  translationBar: {
    width: 2,
    height: 10,
    backgroundColor: "#000",
    marginRight: 4,
    marginTop: 2,
    flexShrink: 0,
  },
  translationLabel: {
    fontWeight: 700,
    fontSize: 6,
    width: 24,
    flexShrink: 0,
    lineHeight: 1.6,
    color: "#333",
  },
  translationContent: {
    flex: 1,
    fontSize: 6,
    color: "#333",
    lineHeight: 1.6,
  },
  passageSection: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#000",
  },
  passageSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 4,
  },
  passageText: {
    fontFamily: "Pretendard",
    fontSize: 9,
    lineHeight: 2,
    textAlign: "justify",
  },
  passageNumber: {
    fontWeight: 700,
    fontSize: 7,
    verticalAlign: "super",
    marginRight: 2,
    color: "#000",
  },
  verbUnderline: {
    textDecoration: "underline",
  },
});

/** Render chunks with slash, applying underline to verbs */
function renderChunksWithVerbUnderline(chunks: Chunk[]) {
  const elements: React.ReactNode[] = [];

  chunks.forEach((chunk, ci) => {
    chunk.segments.forEach((seg, si) => {
      if (seg.isVerb) {
        elements.push(
          <Text key={`${ci}-${si}`} style={styles.verbUnderline}>
            {seg.text}
          </Text>,
        );
      } else {
        elements.push(<Text key={`${ci}-${si}`}>{seg.text}</Text>);
      }
    });
    if (ci < chunks.length - 1) {
      elements.push(<Text key={`slash-${ci}`}> / </Text>);
    }
  });

  return elements;
}

function renderChunksSlashPlain(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(" / ");
}

export function PdfDocument({ results, title, subtitle }: PdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {results.map((result, index) => (
          <View key={result.id} style={styles.sentenceContainer} wrap={false}>
            <View style={styles.sentenceRow}>
              <Text style={styles.sentenceNumber}>{String(index + 1).padStart(2, "0")} </Text>
              <Text style={styles.englishText}>
                {result.englishChunks.length > 0
                  ? renderChunksWithVerbUnderline(result.englishChunks)
                  : result.original}
              </Text>
            </View>

            {result.englishChunks.length > 0 && (
              <View style={styles.translationContainer}>
                {!result.hideLiteral && (
                  <View style={styles.translationRow}>
                    <View style={styles.translationBar} />
                    <Text style={styles.translationLabel}>직역</Text>
                    <Text style={styles.translationContent}>{renderChunksSlashPlain(result.koreanLiteralChunks)}</Text>
                  </View>
                )}
                {!result.hideNatural && (
                  <View style={styles.translationRow}>
                    <View style={styles.translationBar} />
                    <Text style={styles.translationLabel}>의역</Text>
                    <Text style={styles.translationContent}>{result.koreanNatural}</Text>
                  </View>
                )}
                {result.hongTNotes && !result.hideHongT ? (
                  <View style={styles.translationRow}>
                    <View style={styles.translationBar} />
                    <Text style={styles.translationLabel}>홍T</Text>
                    <Text style={styles.translationContent}>{result.hongTNotes}</Text>
                  </View>
                ) : null}
                {result.syntaxNotes ? (
                  <View style={styles.translationRow}>
                    <View style={styles.translationBar} />
                    <Text style={styles.translationLabel}>구문</Text>
                    <Text style={styles.translationContent}>{result.syntaxNotes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ))}

        {/* 지문 전체 — 소제목 없이 */}
        <View style={styles.passageSection} wrap={false}>
          <Text style={styles.passageSectionTitle}>Original Passage</Text>
          <Text style={styles.passageText}>
            {results.map((r, i) => (
              <Text key={r.id}>
                <Text style={styles.passageNumber}>{i + 1} </Text>
                <Text>{r.original} </Text>
              </Text>
            ))}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
