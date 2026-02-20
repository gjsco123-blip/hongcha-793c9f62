import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

// ── Font Registration ──
Font.register({
  family: "Pretendard",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf", fontWeight: 700 },
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

// ── Types ──
interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}

interface StructureStep {
  step: number;
  one_line: string;
  evidence: string;
}

interface ExamBlock {
  topic: string;
  topic_ko?: string;
  title: string;
  title_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}

interface Props {
  vocab: VocabItem[];
  structure: StructureStep[];
  summary: string;
  examBlock: ExamBlock | null;
}

// ── Design tokens ──
const T = {
  fontKo: "Pretendard",
  fontEn: "SourceSerif4",
  black: "#1a1a1a",
  gray70: "#555",
  gray50: "#888",
  gray30: "#bbb",
  gray10: "#f0f0f0",
  gray05: "#f7f7f7",
  rule: "#ccc",
  marginH: 36,
  marginTop: 32,
  marginBottom: 24,
};

const s = StyleSheet.create({
  page: {
    paddingTop: T.marginTop,
    paddingBottom: T.marginBottom,
    paddingLeft: T.marginH,
    paddingRight: T.marginH,
    fontFamily: T.fontKo,
    fontSize: 7,
    color: T.black,
  },

  // Header
  header: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: T.gray50,
  },
  headerTitle: {
    fontFamily: T.fontEn,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  headerTitleKo: {
    fontSize: 8,
    color: T.gray70,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: 5.5,
    fontWeight: 700,
    color: T.gray50,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    width: 36,
    marginTop: 0.5,
  },
  headerValueEn: {
    fontFamily: T.fontEn,
    fontSize: 7,
    color: T.gray70,
    flex: 1,
    lineHeight: 1.5,
  },
  headerValueKo: {
    fontSize: 6.5,
    color: T.gray50,
    flex: 1,
    lineHeight: 1.4,
  },

  // 2-column body
  body: {
    flexDirection: "row",
    gap: 14,
  },
  colLeft: { flex: 6 },
  colRight: { flex: 4 },

  // Section label
  sectionLabel: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: T.gray50,
  },

  // Structure steps
  stepRow: {
    flexDirection: "row",
    marginBottom: 5,
    alignItems: "flex-start",
  },
  stepNum: {
    fontFamily: T.fontEn,
    fontSize: 10,
    fontWeight: 700,
    color: T.black,
    width: 14,
    textAlign: "right" as const,
    marginRight: 6,
    marginTop: -1,
  },
  stepText: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.7,
  },

  // Summary
  summaryBox: {
    borderLeftWidth: 1.5,
    borderLeftColor: T.gray30,
    paddingLeft: 8,
    paddingVertical: 4,
    marginTop: 10,
  },
  summaryText: {
    fontSize: 7.5,
    lineHeight: 1.8,
  },

  // Vocab table
  vocabWarning: {
    fontSize: 5,
    color: T.gray50,
    marginBottom: 4,
    fontStyle: "italic" as const,
  },
  vocabTable: {
    borderWidth: 0.5,
    borderColor: T.rule,
  },
  vocabHeaderRow: {
    flexDirection: "row",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: T.rule,
  },
  vocabRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: "#e8e8e8",
  },
  vocabNum: { width: 10, fontSize: 5, color: T.gray30, textAlign: "center" as const },
  vocabWord: { width: 50, fontFamily: T.fontEn, fontSize: 6.5, fontWeight: 600 },
  vocabPos: { width: 14, fontSize: 5, color: T.gray50, textAlign: "center" as const },
  vocabMeaning: { flex: 1, fontSize: 6, lineHeight: 1.4 },
  vocabHeaderText: { fontSize: 5, fontWeight: 700, color: T.gray50, textTransform: "uppercase" as const, letterSpacing: 0.5 },

  // Divider
  thinRule: {
    height: 0.5,
    backgroundColor: T.rule,
    marginVertical: 8,
  },
});

export function PreviewPdf({ vocab, structure, summary, examBlock }: Props) {
  const hasStructure = structure.length > 0;
  const hasSummary = !!summary;
  const hasVocab = vocab.length > 0;
  const hasExam = !!examBlock;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ══ Header: Title / Topic / Summary ══ */}
        {hasExam && (
          <View style={s.header}>
            <Text style={s.headerTitle}>{examBlock.title}</Text>
            {examBlock.title_ko && <Text style={s.headerTitleKo}>{examBlock.title_ko}</Text>}

            <View style={s.headerRow}>
              <Text style={s.headerLabel}>Topic</Text>
              <Text style={s.headerValueEn}>{examBlock.topic}</Text>
            </View>
            {examBlock.topic_ko && (
              <View style={s.headerRow}>
                <Text style={{ ...s.headerLabel, color: "transparent" }}>Topic</Text>
                <Text style={s.headerValueKo}>{examBlock.topic_ko}</Text>
              </View>
            )}

            <View style={{ ...s.headerRow, marginTop: 2 }}>
              <Text style={s.headerLabel}>Sum.</Text>
              <Text style={s.headerValueEn}>{examBlock.one_sentence_summary}</Text>
            </View>
            {examBlock.one_sentence_summary_ko && (
              <View style={s.headerRow}>
                <Text style={{ ...s.headerLabel, color: "transparent" }}>Sum.</Text>
                <Text style={s.headerValueKo}>{examBlock.one_sentence_summary_ko}</Text>
              </View>
            )}
          </View>
        )}

        {/* ══ 2-Column Body ══ */}
        <View style={s.body}>
          {/* ── LEFT: Key Summary + Structure ── */}
          <View style={s.colLeft}>
            {hasSummary && (
              <View>
                <View style={s.sectionLabel}>
                  <Text style={s.sectionTitle}>Key Summary</Text>
                </View>
                <View style={s.summaryBox}>
                  <Text style={s.summaryText}>{summary}</Text>
                </View>
              </View>
            )}

            {hasStructure && (
              <View>
                {hasSummary && <View style={s.thinRule} />}
                <View style={s.sectionLabel}>
                  <Text style={s.sectionTitle}>Structure</Text>
                </View>
                {structure.map((step) => (
                  <View key={step.step} style={s.stepRow}>
                    <Text style={s.stepNum}>{step.step}</Text>
                    <Text style={s.stepText}>{step.one_line}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── RIGHT: Vocabulary ── */}
          {hasVocab && (
            <View style={s.colRight}>
              <View style={s.sectionLabel}>
                <Text style={s.sectionTitle}>Vocabulary</Text>
              </View>

              {vocab.length < 20 && (
                <Text style={s.vocabWarning}>⚠ {vocab.length}/20</Text>
              )}

              <View style={s.vocabTable}>
                <View style={s.vocabHeaderRow}>
                  <Text style={{ ...s.vocabNum, ...s.vocabHeaderText }}>#</Text>
                  <Text style={{ ...s.vocabWord, ...s.vocabHeaderText, fontFamily: T.fontKo }}>Word</Text>
                  <Text style={{ ...s.vocabPos, ...s.vocabHeaderText }}>POS</Text>
                  <Text style={{ ...s.vocabMeaning, ...s.vocabHeaderText }}>Meaning</Text>
                </View>

                {vocab.map((v, i) => (
                  <View key={i} style={[s.vocabRow, i % 2 === 1 ? { backgroundColor: T.gray05 } : {}]}>
                    <Text style={s.vocabNum}>{i + 1}</Text>
                    <Text style={s.vocabWord}>{v.word}</Text>
                    <Text style={s.vocabPos}>{v.pos}</Text>
                    <Text style={s.vocabMeaning}>{v.meaning_ko}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
