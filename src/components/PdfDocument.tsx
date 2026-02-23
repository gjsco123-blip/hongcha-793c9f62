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

// 5mm = 14.17pt, 12mm = 34.02pt
const GAP = 8.5;
const MEMO_WIDTH = 100;

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 40,
    paddingLeft: 42,
    paddingRight: 34, // 12mm from right edge
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
  // Two-column row
  contentRow: {
    flexDirection: "row",
    alignItems: "stretch",
    flexGrow: 0,
    flexShrink: 0,
  },
  leftColumn: {
    flex: 1,
    paddingRight: GAP,
  },
  memoColumn: {
    width: MEMO_WIDTH,
    backgroundColor: "#f9f9f7",
    borderRadius: 3,
    padding: 8,
    paddingTop: 6,
  },
  memoLabel: {
    fontSize: 6,
    fontWeight: 700,
    color: "#222",
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "right",
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
    color: "#000",
  },
  translationContent: {
    flex: 1,
    fontSize: 6,
    color: "#000",
    lineHeight: 1.6,
  },
  passageSection: {
    marginTop: 18,
    paddingTop: 0,
  },
  passageSectionTitle: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: "#999",
    marginBottom: 3,
  },
  passageTextBox: {
    borderWidth: 0.5,
    borderColor: "#ccc",
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

/** Estimate the height of a single sentence block in points */
function estimateSentenceHeight(result: SentenceResult, isLast: boolean): number {
  let h = 0;
  // English text row: fontSize 9 * lineHeight 2.3 ≈ 21pt
  const engText =
    result.englishChunks.length > 0 ? result.englishChunks.map((c) => c.text).join(" / ") : result.original;
  const engLines = Math.ceil(engText.length / 55); // rough chars per line
  h += engLines * 21;
  h += 6; // sentenceRow marginBottom

  if (result.englishChunks.length > 0) {
    const rowH = 13; // 6pt * 1.6 lineHeight + 3pt marginBottom
    if (!result.hideLiteral) h += rowH;
    if (!result.hideNatural) h += rowH;
    if (result.hongTNotes && !result.hideHongT) h += rowH;
    if (result.syntaxNotes) h += result.syntaxNotes.length * rowH;
  }

  if (!isLast) {
    h += 14 + 8; // marginBottom + paddingBottom + border area
  }

  return h;
}

/** Split results into pages based on estimated heights */
function paginateResults(results: SentenceResult[]): SentenceResult[][] {
  const PAGE_HEIGHT = 841.89; // A4
  const PADDING_V = 42 + 40; // top + bottom
  const HEADER_H = 54; // header height on page 1
  const PASSAGE_H = 90; // reserve for 스스로 분석 section

  const pages: SentenceResult[][] = [];
  let currentPage: SentenceResult[] = [];
  let usedHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < results.length; i++) {
    const isLastResult = i === results.length - 1;
    const isLastInPage = isLastResult; // will be recalculated
    const h = estimateSentenceHeight(results[i], false);

    const pageCapacity = PAGE_HEIGHT - PADDING_V - (isFirstPage ? HEADER_H : 0);

    // Check if adding this sentence would exceed page capacity
    // For the last page, also reserve space for passage section
    const remainingResults = results.length - i;
    const wouldBeLastPage = remainingResults === 1 || usedHeight + h > pageCapacity * 0.85;

    if (usedHeight + h > pageCapacity - (isLastResult ? PASSAGE_H : 0)) {
      // Current page is full, start new page
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        usedHeight = 0;
        isFirstPage = false;
      }
    }

    currentPage.push(results[i]);
    usedHeight += h;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function SentenceBlock({ result, index, isLast }: { result: SentenceResult; index: number; isLast: boolean }) {
  return (
    <View
      key={result.id}
      style={
        isLast
          ? { ...styles.sentenceContainer, marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }
          : styles.sentenceContainer
      }
      wrap={false}
    >
      <View style={styles.sentenceRow}>
        <Text style={styles.sentenceNumber}>{String(index + 1).padStart(2, "0")} </Text>
        <Text style={styles.englishText}>
          {result.englishChunks.length > 0 ? renderChunksWithVerbUnderline(result.englishChunks) : result.original}
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
  );
}

export function PdfDocument({ results, title, subtitle }: PdfDocumentProps) {
  const pages = paginateResults(results);

  // Track global sentence index across pages
  let globalIndex = 0;

  return (
    <Document>
      {pages.map((pageResults, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === pages.length - 1;
        const pageStartIndex = globalIndex;
        globalIndex += pageResults.length;

        return (
          <Page key={pageIdx} size="A4" style={styles.page}>
            {/* Header — only on first page */}
            {isFirstPage && (
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
            )}

            {/* Two-column layout: Left (sentences) + Right (MEMO) — per page */}
            <View style={styles.contentRow}>
              <View style={styles.leftColumn}>
                {pageResults.map((result, idx) => {
                  const isLastInPage = idx === pageResults.length - 1;
                  return (
                    <SentenceBlock key={result.id} result={result} index={pageStartIndex + idx} isLast={isLastInPage} />
                  );
                })}
              </View>

              {/* Right column — MEMO, height matches left column via stretch */}
              <View style={styles.memoColumn}>
                <Text style={styles.memoLabel}>MEMO</Text>
              </View>
            </View>

            {/* 스스로 분석 — only on last page */}
            {isLastPage && (
              <View style={styles.passageSection} wrap={false}>
                <Text style={styles.passageSectionTitle}>TEXT ANALYSIS </Text>
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
            )}
          </Page>
        );
      })}
    </Document>
  );
}
