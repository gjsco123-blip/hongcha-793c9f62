import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Noto Sans KR",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Source Serif 4",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-700-normal.ttf", fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

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

interface Props {
  vocab: VocabItem[];
  structure: StructureStep[];
  explanation: string;
}

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 28,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: "Noto Sans KR",
    fontSize: 7,
    color: "#1a1a1a",
  },
  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 6,
    marginBottom: 12,
  },
  title: {
    fontFamily: "Source Serif 4",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 6,
    color: "#888",
  },
  // ── Section ──
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  sectionTag: {
    fontFamily: "Source Serif 4",
    fontSize: 7,
    fontWeight: 700,
    color: "#666",
    marginRight: 4,
  },
  // ── Vocab table ──
  vocabHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  vocabRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: "#eee",
  },
  vocabNum: { width: 14, fontSize: 5.5, color: "#999", textAlign: "center" },
  vocabWord: { width: 62, fontFamily: "Source Serif 4", fontSize: 7, fontWeight: 700 },
  vocabPos: { width: 18, fontSize: 5.5, color: "#888", textAlign: "center" },
  vocabMeaning: { width: 90, fontSize: 6.5 },
  vocabContext: { flex: 1, fontFamily: "Source Serif 4", fontSize: 5.5, color: "#666", fontStyle: "italic" },
  vocabHeaderText: { fontSize: 5.5, fontWeight: 700, color: "#555" },
  // ── Structure ──
  stepRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 2,
  },
  stepNum: {
    fontFamily: "Source Serif 4",
    fontSize: 8,
    fontWeight: 700,
    width: 14,
    color: "#333",
  },
  stepContent: {
    flex: 1,
  },
  stepOneLine: {
    fontSize: 6.5,
    lineHeight: 1.5,
  },
  stepEvidence: {
    fontFamily: "Source Serif 4",
    fontSize: 5.5,
    color: "#777",
    fontStyle: "italic",
    marginTop: 1,
  },
  // ── Explanation ──
  explanationBox: {
    backgroundColor: "#fafafa",
    borderWidth: 0.5,
    borderColor: "#ddd",
    padding: 8,
    lineHeight: 1.7,
  },
  explanationText: {
    fontSize: 6.5,
  },
  // ── Layout helpers ──
  columns: {
    flexDirection: "row",
    gap: 14,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    width: 200,
  },
  spacer: {
    height: 10,
  },
});

export function PassageBuilderPdf({ vocab, structure, explanation }: Props) {
  // Split vocab into two columns (10 each) for compactness
  const vocabLeft = vocab.slice(0, 10);
  const vocabRight = vocab.slice(10, 20);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>PASSAGE BUILDER</Text>
          <Text style={s.subtitle}>Vocabulary · Structure · Explanation</Text>
        </View>

        {/* ═══ A) Vocabulary ═══ */}
        <View>
          <Text style={s.sectionTitle}>
            <Text style={s.sectionTag}>A</Text> VOCABULARY ({vocab.length})
          </Text>

          {/* Two-column vocab layout */}
          <View style={s.columns}>
            {[vocabLeft, vocabRight].map((col, colIdx) => (
              <View key={colIdx} style={{ flex: 1 }}>
                {/* Header row */}
                <View style={s.vocabHeader}>
                  <Text style={{ ...s.vocabNum, ...s.vocabHeaderText }}>#</Text>
                  <Text style={{ ...s.vocabWord, ...s.vocabHeaderText, fontFamily: "Noto Sans KR" }}>Word</Text>
                  <Text style={{ ...s.vocabPos, ...s.vocabHeaderText }}>품사</Text>
                  <Text style={{ ...s.vocabMeaning, ...s.vocabHeaderText }}>뜻</Text>
                </View>
                {col.map((v, i) => {
                  const num = colIdx * 10 + i + 1;
                  return (
                    <View key={num} style={s.vocabRow}>
                      <Text style={s.vocabNum}>{num}</Text>
                      <Text style={s.vocabWord}>{v.word}</Text>
                      <Text style={s.vocabPos}>{v.pos}</Text>
                      <Text style={s.vocabMeaning}>{v.meaning_ko}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={s.spacer} />

        {/* Bottom section: Structure + Explanation side by side */}
        <View style={s.columns}>
          {/* ═══ B) Structure ═══ */}
          <View style={s.leftCol}>
            <Text style={s.sectionTitle}>
              <Text style={s.sectionTag}>B</Text> STRUCTURE SUMMARY ({structure.length})
            </Text>
            {structure.map((step) => (
              <View key={step.step} style={s.stepRow}>
                <Text style={s.stepNum}>{step.step}.</Text>
                <View style={s.stepContent}>
                  <Text style={s.stepOneLine}>{step.one_line}</Text>
                  <Text style={s.stepEvidence}>"{step.evidence}"</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ═══ C) Explanation ═══ */}
          <View style={s.rightCol}>
            <Text style={s.sectionTitle}>
              <Text style={s.sectionTag}>C</Text> EASY EXPLANATION
            </Text>
            <View style={s.explanationBox}>
              <Text style={s.explanationText}>{explanation}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
