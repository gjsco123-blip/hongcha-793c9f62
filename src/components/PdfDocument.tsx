import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/PdfHeader";
import { Chunk, segmentsToWords } from "@/lib/chunk-utils";
import { paginateResults, type PaginationSentence } from "@/lib/pdf-pagination";
import { computeSuperscriptPositions, type SyntaxNoteWithTarget } from "@/lib/syntax-superscript";

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
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@4.0/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@4.0/latin-600-normal.ttf", fontWeight: 600 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@4.0/latin-700-normal.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Jua",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/jua@5.1/korean-400-normal.ttf",
});

Font.register({
  family: "GangwonEduSaeeum",
  src: "https://cdn.jsdelivr.net/gh/fonts-archive/GangwonEduSaeeum@master/GangwonEduSaeeum.ttf",
});

Font.registerHyphenationCallback((word) => [word]);

interface SyntaxNote {
  id: number;
  content: string;
  targetText?: string;
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
  teacherLabel?: string;
}

// 5mm = 14.17pt, 12mm = 34.02pt
const GAP = 8.5;
const MEMO_WIDTH = 100;

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 30,
    paddingLeft: 42,
    paddingRight: 34, // 12mm from right edge
    fontFamily: "Pretendard",
    fontSize: 9,
    lineHeight: 1.8,
  },
  header: {
    // kept for backward compat but no longer used for spacing
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
    marginTop: 4,
  },
  // Two-column row
  contentRow: {
    flexDirection: "row",
    position: "relative",
    flexGrow: 0,
    flexShrink: 0,
  },
  leftColumn: {
    flex: 1,
    paddingRight: GAP + MEMO_WIDTH,
  },
  memoColumn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
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
    fontSize: 9.5,
    fontWeight: 700,
    width: "auto",
    flexShrink: 6,
    lineHeight: 2.2,
    marginTop: 0,
  },
  englishText: {
    fontFamily: "Pretendard",
    fontWeight: 600,
    fontSize: 9.5,
    lineHeight: 2.5,
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
    backgroundColor: "#777",
    marginRight: 2,
    marginTop: 1,
    flexShrink: 0,
  },
  translationLabel: {
    fontWeight: 600,
    fontSize: 6.5,
    width: 17,
    flexShrink: 0,
    lineHeight: 1.8,
    color: "#777",
  },
  translationContent: {
    flex: 1,
    fontSize: 6.5,
    color: "#222",
    lineHeight: 1.8,
  },
  passageSection: {
    marginTop: 18,
    paddingTop: 0,
    marginRight: 8,
  },
  passageSectionTitle: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: "#666",
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

/** Render chunks with slash, applying underline to verbs and superscript for syntax notes */
function renderChunksWithVerbUnderline(chunks: Chunk[], syntaxNotes?: SyntaxNote[], original?: string) {
  const elements: React.ReactNode[] = [];

  const clampToWordStart = (text: string, rawOffset: number) => {
    let o = Math.max(0, Math.min(rawOffset, text.length));
    // If mapped offset lands on whitespace/punctuation, move to the next word start.
    while (o < text.length && !/[A-Za-z0-9]/.test(text[o])) o++;
    // If annotation points inside a word, snap to that word start to avoid t¹hat-style splits.
    while (o > 0 && /[A-Za-z0-9]/.test(text[o - 1])) o--;
    return o;
  };

  // Use shared matching logic: compute positions on original text
  const fullText = original || chunks.map((c) => c.text).join(" ");
  const positions = computeSuperscriptPositions(fullText, (syntaxNotes || []) as SyntaxNoteWithTarget[]);

  // Build chunk offset ranges relative to original text
  const superscriptMap = new Map<string, { id: number; offset: number }[]>();
  const addSup = (key: string, entry: { id: number; offset: number }) => {
    const arr = superscriptMap.get(key) || [];
    arr.push(entry);
    superscriptMap.set(key, arr);
  };

  const chunkOffsets: { ci: number; start: number; end: number; segOffsets: { si: number; start: number; end: number }[] }[] = [];
  {
    const fullTextLower = fullText.toLowerCase();
    let cursor = 0;
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkText = chunks[ci].text || "";
      const chunkTextLower = chunkText.toLowerCase();
      let chunkStart = fullTextLower.indexOf(chunkTextLower, cursor);
      if (chunkStart === -1) chunkStart = cursor;
      const chunkEnd = chunkStart + chunkText.length;

      // Map segment offsets by locating each segment inside the located chunk text.
      const segOffsets: { si: number; start: number; end: number }[] = [];
      let segLocalCursor = 0;
      for (let si = 0; si < chunks[ci].segments.length; si++) {
        const segText = chunks[ci].segments[si].text || "";
        const segTextLower = segText.toLowerCase();

        let segStart = chunkStart + segLocalCursor;
        if (segTextLower) {
          const localIdx = chunkTextLower.indexOf(segTextLower, segLocalCursor);
          if (localIdx !== -1) {
            segStart = chunkStart + localIdx;
            segLocalCursor = localIdx + segText.length;
          } else {
            const globalIdx = fullTextLower.indexOf(segTextLower, chunkStart + segLocalCursor);
            if (globalIdx !== -1) {
              segStart = globalIdx;
              segLocalCursor = Math.max(segLocalCursor, globalIdx - chunkStart + segText.length);
            } else {
              segLocalCursor += segText.length;
            }
          }
        }
        const segEnd = segStart + segText.length;
        segOffsets.push({ si, start: segStart, end: segEnd });
      }

      chunkOffsets.push({ ci, start: chunkStart, end: chunkEnd, segOffsets });
      cursor = chunkEnd;
    }
  }

  // Map shared positions to chunk/segment coordinates
  for (const [matchStart, noteIds] of positions) {
    let placed = false;
    for (const co of chunkOffsets) {
      if (matchStart >= co.start && matchStart < co.end) {
        for (const so of co.segOffsets) {
          if (matchStart >= so.start && matchStart < so.end) {
            const segText = chunks[co.ci].segments[so.si]?.text ?? "";
            const offsetInSeg = clampToWordStart(segText, matchStart - so.start);
            for (const id of noteIds) addSup(`${co.ci}-${so.si}`, { id, offset: offsetInSeg });
            placed = true;
            break;
          }
        }
        if (!placed) {
          for (const id of noteIds) {
            addSup(`${co.ci}-0`, { id, offset: 0 });
          }
          placed = true;
        }
        break;
      }
    }
    if (!placed) {
      for (const id of noteIds) {
        addSup(`0-0`, { id, offset: 0 });
      }
    }
  }

  const renderSup = (key: string, id: number) => (
    <Text key={key} style={{ fontSize: 5, verticalAlign: "super" as const }}>
      {String(id)}
    </Text>
  );

  chunks.forEach((chunk, ci) => {
    chunk.segments.forEach((seg, si) => {
      const sups = superscriptMap.get(`${ci}-${si}`) || [];
      // Group by exact offset so multiple note ids can be rendered at the same anchor.
      const groupedByOffset = new Map<number, number[]>();
      for (const s of sups) {
        const offset = Math.max(0, Math.min(s.offset, seg.text.length));
        const ids = groupedByOffset.get(offset) || [];
        ids.push(s.id);
        groupedByOffset.set(offset, ids);
      }
      const supEvents = [...groupedByOffset.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([offset, ids]) => ({ offset, ids }));

      const pushSegmentText = (text: string, keyBase: string) => {
        if (!text) return;
        const canUnderline = seg.isVerb && /[A-Za-z]/.test(text);
        if (!canUnderline) {
          elements.push(<Text key={keyBase}>{text}</Text>);
          return;
        }
        const match = text.match(/^(.*\S)([\s,.:;!?]+)$/);
        if (match) {
          elements.push(
            <Text key={`${keyBase}-v`} style={styles.verbUnderline}>
              {match[1]}
            </Text>,
          );
          elements.push(<Text key={`${keyBase}-p`}>{match[2]}</Text>);
          return;
        }
        elements.push(
          <Text key={keyBase} style={styles.verbUnderline}>
            {text}
          </Text>,
        );
      };

      let cursor = 0;
      supEvents.forEach((event, ei) => {
        if (event.offset > cursor) {
          pushSegmentText(seg.text.slice(cursor, event.offset), `${ci}-${si}-txt-${ei}`);
        }
        event.ids.forEach((id, idi) => {
          elements.push(renderSup(`${ci}-${si}-sup-${ei}-${idi}-${id}`, id));
        });
        cursor = event.offset;
      });
      pushSegmentText(seg.text.slice(cursor), `${ci}-${si}-txt-tail`);
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

// Height estimation & pagination now live in src/lib/pdf-pagination.ts

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
          {result.englishChunks.length > 0
            ? renderChunksWithVerbUnderline(result.englishChunks, result.syntaxNotes, result.original)
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
            ? result.syntaxNotes.flatMap((n) => {
                const lines = n.content.split("\n").filter((l) => l.trim());
                return lines.map((line, li) => (
                  <View key={`${n.id}-${li}`} style={styles.translationRow}>
                    {n.id === 1 && li === 0 ? (
                      <View style={styles.translationBar} />
                    ) : (
                      <View style={{ width: 2, marginRight: 2, flexShrink: 0 }} />
                    )}
                    <Text style={styles.translationLabel}>{n.id === 1 && li === 0 ? "구문" : ""}</Text>
                    <Text
                      style={{
                        fontFamily: "Pretendard",
                        fontSize: 6.5,
                        fontWeight: 600,
                        width: 10,
                        flexShrink: 0,
                        color: "#222",
                        lineHeight: 1.6,
                        textAlign: "left" as const,
                      }}
                    >
                      {li === 0 ? `${n.id}.` : ""}
                    </Text>
                    <Text style={{ ...styles.translationContent, fontWeight: 600 }}>
                      {line.replace(/^\s*[•·\-\*]\s*/, "")}
                    </Text>
                  </View>
                ));
              })
            : null}
        </View>
      )}
    </View>
  );
}

export function PdfDocument({ results, title, subtitle }: PdfDocumentProps) {
  const { pages } = paginateResults(results);

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
            {isFirstPage && <PdfHeader title={title} titleColor="#666" ruleColor="#666" />}

            {/* Two-column layout: Left (sentences) + Right (MEMO) — per page */}
            <View style={styles.contentRow} wrap={false}>
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
