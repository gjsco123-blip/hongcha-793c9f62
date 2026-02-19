import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Pretendard",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Regular.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-SemiBold.ttf", fontWeight: 600 },
    { src: "https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Bold.ttf", fontWeight: 700 },
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
    paddingTop: 30,
    paddingBottom: 24,
    paddingLeft: 36,
    paddingRight: 36,
    fontFamily: "Pretendard",
    fontSize: 7,
    color: "#222",
  },
  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#222",
  },
  title: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 6.5,
    color: "#999",
    letterSpacing: 0.5,
  },
  // ── Section ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionBadge: {
    fontFamily: "Inter",
    fontSize: 7,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#222",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginRight: 6,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.6,
  },
  sectionCount: {
    fontSize: 6.5,
    color: "#999",
    marginLeft: 4,
  },
  // ── Vocab table ──
  vocabHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  vocabRow: {
    flexDirection: "row",
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: "#e5e5e5",
  },
  vocabRowAlt: {
    backgroundColor: "#fafafa",
  },
  vocabNum: { width: 14, fontSize: 5.5, color: "#aaa", textAlign: "center" },
  vocabWord: { width: 60, fontFamily: "Inter", fontSize: 7, fontWeight: 600 },
  vocabPos: { width: 20, fontSize: 5.5, color: "#888", textAlign: "center" },
  vocabMeaning: { flex: 1, fontSize: 6.5 },
  vocabHeaderText: { fontSize: 5.5, fontWeight: 700, color: "#666" },
  // ── Structure ──
  stepRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-start",
  },
  stepNum: {
    fontFamily: "Inter",
    fontSize: 8,
    fontWeight: 600,
    color: "#333",
    width: 14,
    marginRight: 4,
    marginTop: 0.5,
  },
  stepText: {
    flex: 1,
    fontSize: 7.5,
    lineHeight: 1.6,
  },
  // ── Explanation ──
  explanationBox: {
    backgroundColor: "#f8f8f8",
    borderLeftWidth: 2.5,
    borderLeftColor: "#333",
    padding: 10,
    paddingLeft: 12,
  },
  explanationText: {
    fontSize: 7.5,
    lineHeight: 2,
    textAlign: "justify",
  },
  // ── Layout helpers ──
  columns: {
    flexDirection: "row",
    gap: 12,
  },
  spacer: {
    height: 12,
  },
  divider: {
    height: 0.5,
    backgroundColor: "#ddd",
    marginVertical: 10,
  },
});

export function PassageBuilderPdf({ vocab, structure, explanation }: Props) {
  const vocabLeft = vocab.slice(0, 10);
  const vocabRight = vocab.slice(10, 20);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>PASSAGE BUILDER</Text>
          <Text style={s.subtitle}>Pre-Study Guide</Text>
        </View>

        {/* ═══ A) Vocabulary ═══ */}
        <View>
          <View style={s.sectionHeader}>
            <Text style={s.sectionBadge}>A</Text>
            <Text style={s.sectionLabel}>VOCABULARY</Text>
            <Text style={s.sectionCount}>({vocab.length})</Text>
          </View>

          <View style={s.columns}>
            {[vocabLeft, vocabRight].map((col, colIdx) => (
              <View key={colIdx} style={{ flex: 1 }}>
                <View style={s.vocabHeader}>
                  <Text style={{ ...s.vocabNum, ...s.vocabHeaderText }}>#</Text>
                  <Text style={{ ...s.vocabWord, ...s.vocabHeaderText, fontFamily: "Pretendard" }}>Word</Text>
                  <Text style={{ ...s.vocabPos, ...s.vocabHeaderText }}>품사</Text>
                  <Text style={{ ...s.vocabMeaning, ...s.vocabHeaderText }}>뜻</Text>
                </View>
                {col.map((v, i) => {
                  const num = colIdx * 10 + i + 1;
                  return (
                    <View key={num} style={[s.vocabRow, i % 2 === 1 ? s.vocabRowAlt : {}]}>
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

        <View style={s.divider} />

        {/* Bottom: Structure + Explanation side by side */}
        <View style={s.columns}>
          {/* ═══ B) Structure ═══ */}
          <View style={{ flex: 1 }}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionBadge}>B</Text>
              <Text style={s.sectionLabel}>STRUCTURE</Text>
              <Text style={s.sectionCount}>({structure.length})</Text>
            </View>
            {structure.map((step) => (
              <View key={step.step} style={s.stepRow}>
                <Text style={s.stepNum}>{step.step}.</Text>
                <Text style={s.stepText}>{step.one_line}</Text>
              </View>
            ))}
          </View>

          {/* ═══ C) Explanation ═══ */}
          <View style={{ width: 210 }}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionBadge}>C</Text>
              <Text style={s.sectionLabel}>쉬운 해설</Text>
            </View>
            <View style={s.explanationBox}>
              <Text style={s.explanationText}>{explanation}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
