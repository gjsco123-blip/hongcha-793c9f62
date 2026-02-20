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
  title: string;
  one_sentence_summary: string;
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
  colorBlack: "#1a1a1a",
  colorGray70: "#555",
  colorGray50: "#888",
  colorGray30: "#bbb",
  colorGray10: "#f0f0f0",
  colorGray05: "#f7f7f7",
  lineRule: "#ccc",
  pageMarginH: 36,
  pageMarginTop: 32,
  pageMarginBottom: 24,
};

const s = StyleSheet.create({
  page: {
    paddingTop: T.pageMarginTop,
    paddingBottom: T.pageMarginBottom,
    paddingLeft: T.pageMarginH,
    paddingRight: T.pageMarginH,
    fontFamily: T.fontKo,
    fontSize: 7,
    color: T.colorBlack,
  },

  // ── Header ──
  header: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: T.colorBlack,
  },
  headerTitle: {
    fontFamily: T.fontEn,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerInfoRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  headerLabel: {
    fontSize: 5.5,
    fontWeight: 700,
    color: T.colorGray50,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    width: 32,
    marginTop: 0.5,
  },
  headerValue: {
    fontSize: 7,
    color: T.colorGray70,
    flex: 1,
    lineHeight: 1.5,
  },
  headerValueEn: {
    fontFamily: T.fontEn,
    fontSize: 7,
    color: T.colorGray70,
    flex: 1,
    lineHeight: 1.5,
  },

  // ── 2-column body ──
  body: {
    flexDirection: "row",
    gap: 14,
  },
  colLeft: {
    flex: 6, // 60%
  },
  colRight: {
    flex: 4, // 40%
  },

  // ── Section label ──
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 5,
  },
  sectionBadge: {
    fontFamily: T.fontEn,
    fontSize: 6,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: T.colorBlack,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.5,
  },

  // ── Structure steps ──
  stepRow: {
    flexDirection: "row",
    marginBottom: 7,
    alignItems: "flex-start",
  },
  stepNum: {
    fontFamily: T.fontEn,
    fontSize: 11,
    fontWeight: 700,
    color: T.colorBlack,
    width: 16,
    textAlign: "right" as const,
    marginRight: 6,
    marginTop: -1,
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    fontSize: 8,
    lineHeight: 1.7,
  },
  stepEvidence: {
    fontFamily: T.fontEn,
    fontSize: 5.5,
    color: T.colorGray50,
    marginTop: 1,
    fontStyle: "italic" as const,
  },

  // ── Summary ──
  summaryBox: {
    backgroundColor: T.colorGray05,
    borderLeftWidth: 2,
    borderLeftColor: T.colorGray70,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  summaryText: {
    fontSize: 7.5,
    lineHeight: 1.8,
    textAlign: "justify" as const,
  },

  // ── Vocab table ──
  vocabWarning: {
    fontSize: 5,
    color: T.colorGray50,
    marginBottom: 4,
    fontStyle: "italic" as const,
  },
  vocabTable: {
    borderWidth: 0.5,
    borderColor: T.lineRule,
  },
  vocabHeaderRow: {
    flexDirection: "row",
    backgroundColor: T.colorGray10,
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: T.lineRule,
  },
  vocabRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: "#e8e8e8",
  },
  vocabRowAlt: {
    backgroundColor: T.colorGray05,
  },
  vocabNum: { width: 10, fontSize: 5, color: T.colorGray30, textAlign: "center" as const },
  vocabWord: { width: 46, fontFamily: T.fontEn, fontSize: 6.5, fontWeight: 600 },
  vocabPos: { width: 14, fontSize: 5, color: T.colorGray50, textAlign: "center" as const },
  vocabMeaning: { flex: 1, fontSize: 6, lineHeight: 1.4 },
  vocabContext: { width: 50, fontFamily: T.fontEn, fontSize: 5, color: T.colorGray50, fontStyle: "italic" as const },
  vocabHeaderText: { fontSize: 5, fontWeight: 700, color: T.colorGray50, textTransform: "uppercase" as const, letterSpacing: 0.5 },

  // ── Divider ──
  thinRule: {
    height: 0.5,
    backgroundColor: T.lineRule,
    marginVertical: 8,
  },
});

export function PreviewPdf({ vocab, structure, summary, examBlock }: Props) {
  const hasStructure = structure.length > 0;
  const hasSummary = !!summary;
  const hasVocab = vocab.length > 0;
  const hasExam = !!examBlock;

  // Split vocab into two halves for compact display
  const vocabTop = vocab.slice(0, 10);
  const vocabBottom = vocab.slice(10, 20);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ══ Header ══ */}
        {hasExam && (
          <View style={s.header}>
            <Text style={s.headerTitle}>{examBlock.title}</Text>
            <View style={{ gap: 3 }}>
              <View style={s.headerInfoRow}>
                <Text style={s.headerLabel}>Topic</Text>
                <Text style={s.headerValue}>{examBlock.topic}</Text>
              </View>
              <View style={s.headerInfoRow}>
                <Text style={s.headerLabel}>Sum.</Text>
                <Text style={s.headerValueEn}>{examBlock.one_sentence_summary}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ══ 2-Column Body ══ */}
        <View style={s.body}>
          {/* ── LEFT: Structure + Summary ── */}
          <View style={s.colLeft}>
            {hasStructure && (
              <View>
                <View style={s.sectionLabel}>
                  <Text style={s.sectionBadge}>A</Text>
                  <Text style={s.sectionTitle}>구조 흐름</Text>
                </View>
                {structure.map((step) => (
                  <View key={step.step} style={s.stepRow}>
                    <Text style={s.stepNum}>{step.step}</Text>
                    <View style={s.stepBody}>
                      <Text style={s.stepText}>{step.one_line}</Text>
                      <Text style={s.stepEvidence}>({step.evidence})</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {hasSummary && (
              <View>
                {hasStructure && <View style={s.thinRule} />}
                <View style={s.sectionLabel}>
                  <Text style={s.sectionBadge}>B</Text>
                  <Text style={s.sectionTitle}>핵심 요약</Text>
                </View>
                <View style={s.summaryBox}>
                  <Text style={s.summaryText}>{summary}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── RIGHT: Vocab ── */}
          {hasVocab && (
            <View style={s.colRight}>
              <View style={s.sectionLabel}>
                <Text style={s.sectionBadge}>C</Text>
                <Text style={s.sectionTitle}>핵심 어휘</Text>
                <Text style={{ fontSize: 5.5, color: T.colorGray50, marginLeft: 3 }}>({vocab.length})</Text>
              </View>

              {vocab.length < 20 && (
                <Text style={s.vocabWarning}>⚠ 어휘 {vocab.length}/20</Text>
              )}

              {/* Vocab table */}
              <View style={s.vocabTable}>
                {/* Header */}
                <View style={s.vocabHeaderRow}>
                  <Text style={{ ...s.vocabNum, ...s.vocabHeaderText }}>#</Text>
                  <Text style={{ ...s.vocabWord, ...s.vocabHeaderText, fontFamily: T.fontKo }}>Word</Text>
                  <Text style={{ ...s.vocabPos, ...s.vocabHeaderText }}></Text>
                  <Text style={{ ...s.vocabMeaning, ...s.vocabHeaderText }}>뜻</Text>
                  <Text style={{ ...s.vocabContext, ...s.vocabHeaderText }}>Context</Text>
                </View>

                {/* Rows */}
                {vocab.map((v, i) => (
                  <View key={i} style={[s.vocabRow, i % 2 === 1 ? s.vocabRowAlt : {}]}>
                    <Text style={s.vocabNum}>{i + 1}</Text>
                    <Text style={s.vocabWord}>{v.word}</Text>
                    <Text style={s.vocabPos}>{v.pos}</Text>
                    <Text style={s.vocabMeaning}>{v.meaning_ko}</Text>
                    <Text style={s.vocabContext}>{v.in_context}</Text>
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
