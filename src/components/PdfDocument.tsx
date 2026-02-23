import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { Chunk, segmentsToWords } from "@/lib/chunk-utils";

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

Font.register({
  family: "SourceSerif4",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-600-normal.ttf", fontWeight: 600 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-700-normal.ttf", fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

interface SyntaxNote {
  id: number;
  content: string;
}

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: SyntaxNote[];
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
    paddingBottom: 40,
    paddingLeft: 57,
    paddingRight: 120,
    fontFamily: "Pretendard",
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
    marginBottom: 14,
    paddingBottom: 8,
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
    fontSize: 9,
    fontWeight: 700,
    width: "auto",
    flexShrink: 6,
    lineHeight: 2.2,
    marginTop: 0,
  },
  englishText: {
    fontFamily: "Pretendard",
    fontWeight: 600,
    fontSize: 9,
    lineHeight: 2.3,
    flex: 1,
    marginLeft: 6,
  },
  translationContainer: {
    marginLeft: -2,
  },
  translationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  translationBar: {
    width: 2,
    height: 6,
    backgroundColor: "#000",
    marginRight: 2,
    marginTop: 1,
    flexShrink: 0,
  },
  translationLabel: {
    fontWeight: 700,
    fontSize: 6,
    width: 17,
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
    marginTop: 3,
    paddingTop: 0,
  },
  passageSectionTitle: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#999",
    marginBottom: 6,
  },
  passageTextBox: {
    backgroundColor: "#f9f9f7",
    borderRadius: 4,
    padding: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  passageText: {
    fontFamily: "Pretendard",
    fontWeight: 400,
    fontSize: 9,
    lineHeight: 2,
    textAlign: "justify" as const,
  },
  passageNumber: {
    fontWeight: 600,
    fontSize: 5,
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
        // Split trailing punctuation so underline only covers the word
        const match = seg.text.match(/^(.*\S)([\s,.:;!?]+)$/);
        if (match) {
          elements.push(
            <Text key={`${ci}-${si}-v`} style={styles.verbUnderline}>
              {match[1]}
            </Text>,
          );
          elements.push(<Text key={`${ci}-${si}-p`}>{match[2]}</Text>);
        } else {
          elements.push(
            <Text key={`${ci}-${si}`} style={styles.verbUnderline}>
              {seg.text}
            </Text>,
          );
        }
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

/** Estimate total content height to calculate remaining space for MEMO */
function estimateMemoLines(results: SentenceResult[]): number {
  const PAGE_USABLE = 841.89 - 42 - 40; // A4 height minus paddingTop/Bottom

  // Header: title + subtitle + border + margins
  const headerHeight = 16 + 9 + 12 + 24 + 14; // ~75

  const TRANS_CHARS_PER_LINE = 60;
  const TRANS_LINE_H = 6 * 1.6; // 9.6pt
  const TRANS_ROW_GAP = 3;

  // Calculate individual block heights
  const blockHeights: number[] = [];
  for (const r of results) {
    const engText = r.englishChunks.length > 0
      ? r.englishChunks.map(c => c.text).join(" / ")
      : r.original;
    const engLines = Math.max(1, Math.ceil(engText.length / 75));
    const engHeight = engLines * (9 * 2.3) + 6;

    let transHeight = 0;
    if (r.englishChunks.length > 0) {
      const estimateRowH = (text: string) => {
        const lines = Math.max(1, Math.ceil(text.length / TRANS_CHARS_PER_LINE));
        return lines * TRANS_LINE_H + TRANS_ROW_GAP;
      };
      if (!r.hideLiteral) {
        const litText = r.koreanLiteralChunks.map(c => c.text).join(" / ");
        transHeight += estimateRowH(litText);
      }
      if (!r.hideNatural) {
        transHeight += estimateRowH(r.koreanNatural);
      }
      if (r.hongTNotes && !r.hideHongT) {
        transHeight += estimateRowH(r.hongTNotes);
      }
      if (r.syntaxNotes) {
        for (const n of r.syntaxNotes) {
          transHeight += estimateRowH(n.content);
        }
      }
    }

    blockHeights.push(engHeight + transHeight + 14 + 8);
  }

  // 스스로 분석 section height
  const passageText = results.map(r => r.original).join(" ");
  const passageLines = Math.max(1, Math.ceil(passageText.length / 72));
  const passageBlockHeight = 3 + 7 + 6 + 12 + (passageLines * 9 * 2) + 12;

  // MEMO header
  const memoHeaderHeight = 14 + 7 + 6;

  // --- Page-break simulation (wrap={false} blocks) ---
  let cursor = headerHeight;

  for (const bh of blockHeights) {
    if (cursor + bh > PAGE_USABLE) {
      // Block doesn't fit on current page → jump to next page
      cursor = PAGE_USABLE + bh; // next page starts at PAGE_USABLE, block occupies bh
    } else {
      cursor += bh;
    }
  }

  // Passage block (also wrap={false})
  if (cursor + passageBlockHeight > PAGE_USABLE && cursor < PAGE_USABLE) {
    cursor = PAGE_USABLE + passageBlockHeight;
  } else if (cursor + passageBlockHeight > PAGE_USABLE * 2) {
    // Already on page 2 and doesn't fit — push to theoretical page 3 area
    cursor = PAGE_USABLE * 2 + passageBlockHeight;
  } else {
    cursor += passageBlockHeight;
  }

  cursor += memoHeaderHeight;

  const TWO_PAGES_TOTAL = PAGE_USABLE * 2;
  const remainingHeight = TWO_PAGES_TOTAL - cursor;

  const MEMO_LINE_HEIGHT = 18;
  const safetyMargin = 1;
  const calculatedLines = Math.floor(remainingHeight / MEMO_LINE_HEIGHT) - safetyMargin;

  // Clamp: minimum 3, maximum 9 (9 rows + 1 top border = 10 visible lines)
  return Math.max(3, Math.min(9, calculatedLines));
}

export function PdfDocument({ results, title, subtitle }: PdfDocumentProps) {
  const memoLineCount = estimateMemoLines(results);

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
                {result.syntaxNotes && result.syntaxNotes.length > 0
                  ? result.syntaxNotes.map((n) => (
                      <View key={n.id} style={styles.translationRow}>
                        {n.id === 1 ? (
                          <View style={styles.translationBar} />
                        ) : (
                          <View style={{ width: 2, marginRight: 2, flexShrink: 0 }} />
                        )}
                        <Text style={styles.translationLabel}>{n.id === 1 ? "구문" : ""}</Text>
                        <Text
                          style={{
                            fontFamily: "Pretendard",
                            fontSize: 6,
                            fontWeight: 600,
                            width: 10,
                            flexShrink: 0,
                            color: "#333",
                            lineHeight: 1.6,
                            textAlign: "left" as const,
                          }}
                        >
                          {n.id}.
                        </Text>
                        <Text style={{ ...styles.translationContent, fontWeight: 600 }}>
                          {n.content.replace(/^\s*[•·\-\*]\s*/, "")}
                        </Text>
                      </View>
                    ))
                  : null}
              </View>
            )}
          </View>
        ))}

        {/* 지문 전체 — 소제목 없이 */}
        <View style={styles.passageSection} wrap={false}>
          <Text style={styles.passageSectionTitle}>스스로 분석</Text>
          <View style={styles.passageTextBox}>
            <Text style={styles.passageText}>
              {results.map((r, i) => (
                <Text key={r.id}>
                  <Text style={styles.passageNumber}>{i + 1} </Text>
                  <Text>{r.original} </Text>
                </Text>
              ))}
            </Text>
          </View>
        </View>

        {/* 메모 영역 — 남은 공간 기반 동적 줄 수 */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, color: "#999" }}>MEMO</Text>
          <View style={{ borderTopWidth: 0.5, borderTopColor: "#e0e0e0" }}>
            {Array.from({ length: memoLineCount }).map((_, i) => (
              <View
                key={`memo-line-${i}`}
                style={{
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#e0e0e0",
                  height: 18,
                }}
              />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
