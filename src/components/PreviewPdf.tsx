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
interface VocabItem { word: string; pos: string; meaning_ko: string; in_context: string; }
interface StructureStep { step: number; one_line: string; evidence: string; }
interface ExamBlock {
  topic: string; topic_ko?: string;
  title: string; title_ko?: string;
  one_sentence_summary: string; one_sentence_summary_ko?: string;
}
interface Props { vocab: VocabItem[]; structure: StructureStep[]; summary: string; examBlock: ExamBlock | null; }

// ── Design tokens ──
const T = {
  ko: "Pretendard",
  en: "SourceSerif4",
  black: "#1a1a1a",
  g70: "#555",
  g50: "#888",
  g30: "#bbb",
  g10: "#f0f0f0",
  g05: "#f8f8f8",
  rule: "#d0d0d0",
  mH: 40,
  mT: 40,
  mB: 36,
};

const s = StyleSheet.create({
  page: { paddingTop: T.mT, paddingBottom: T.mB, paddingLeft: T.mH, paddingRight: T.mH, fontFamily: T.ko, fontSize: 8.5, color: T.black },

  // Section title — clean, understated
  secTitle: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" as const, color: T.g50, marginBottom: 10 },

  // Thin rule between sections
  thinRule: { height: 0.5, backgroundColor: T.rule, marginVertical: 16 },

  // Vocabulary
  vocabWarn: { fontSize: 6.5, color: T.g50, marginBottom: 5, fontStyle: "italic" as const },
  vocabRow2Col: { flexDirection: "row" as const, gap: 20 },
  vocabCol: { flex: 1 },
  vocabTable: { borderWidth: 0.5, borderColor: T.rule },
  vocabHdr: { flexDirection: "row" as const, paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: T.rule },
  vocabRow: { flexDirection: "row" as const, paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.3, borderBottomColor: "#e4e4e4" },
  vNum: { width: 18, fontSize: 6.5, color: T.g30, textAlign: "center" as const },
  vWord: { width: 68, fontFamily: T.en, fontSize: 8.5, fontWeight: 600 },
  vPos: { width: 22, fontSize: 6, color: T.g50, textAlign: "center" as const },
  vMeaning: { flex: 1, fontSize: 8, lineHeight: 1.5 },
  vHdrText: { fontSize: 6, fontWeight: 700, color: T.g50, textTransform: "uppercase" as const, letterSpacing: 0.4 },

  // Key Summary — left bar accent
  summaryBox: { borderLeftWidth: 2, borderLeftColor: T.g30, paddingLeft: 10, paddingVertical: 3 },
  summaryLine: { fontSize: 9, lineHeight: 1.7 },

  // Structure — centered text with arrow below
  structureBox: { borderLeftWidth: 2, borderLeftColor: T.g30, paddingLeft: 10, paddingVertical: 3 },
  structItem: { alignItems: "center" as const },
  structText: { fontSize: 8.5, lineHeight: 1.7, textAlign: "center" as const },
  structArrow: { fontSize: 7, color: T.g30, marginVertical: 3 },

  // Topic/Title/Summary fields
  fieldLabel: { fontSize: 6.5, fontWeight: 700, color: T.g50, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 3, marginTop: 12 },
  fieldEn: { fontFamily: T.en, fontSize: 9, color: T.black, lineHeight: 1.6 },
  fieldEnTitle: { fontFamily: T.en, fontSize: 10, color: T.black, lineHeight: 1.5 },
  fieldKo: { fontSize: 7.5, color: T.g70, lineHeight: 1.5, marginTop: 1.5 },
});

function VocabColumn({ items, startNum }: { items: VocabItem[]; startNum: number }) {
  return (
    <View style={s.vocabCol}>
      <View style={s.vocabTable}>
        <View style={s.vocabHdr}>
          <Text style={{ ...s.vNum, ...s.vHdrText }}>#</Text>
          <Text style={{ ...s.vWord, ...s.vHdrText, fontFamily: T.ko }}>Word</Text>
          <Text style={{ ...s.vPos, ...s.vHdrText }}>POS</Text>
          <Text style={{ ...s.vMeaning, ...s.vHdrText }}>Meaning</Text>
        </View>
        {items.map((v, i) => (
          <View key={i} style={s.vocabRow}>
            <Text style={s.vNum}>{startNum + i}</Text>
            <Text style={s.vWord}>{v.word}</Text>
            <Text style={s.vPos}>{v.pos}</Text>
            <Text style={s.vMeaning}>{v.meaning_ko}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PreviewPdf({ vocab, structure, summary, examBlock }: Props) {
  const hasStructure = structure.length > 0;
  const hasSummary = !!summary;
  const hasVocab = vocab.length > 0;
  const hasExam = !!examBlock;
  const summaryLines = summary ? summary.split("\n").filter(Boolean) : [];

  const vocabLeft = vocab.slice(0, 10);
  const vocabRight = vocab.slice(10, 20);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ═══ 1. Vocabulary ═══ */}
        {hasVocab && (
          <View>
            <Text style={s.secTitle}>Vocabulary</Text>
            {vocab.length < 20 && <Text style={s.vocabWarn}>⚠ {vocab.length}/20</Text>}
            <View style={s.vocabRow2Col}>
              <VocabColumn items={vocabLeft} startNum={1} />
              {vocabRight.length > 0 && <VocabColumn items={vocabRight} startNum={11} />}
            </View>
          </View>
        )}

        {/* ═══ 2. Key Summary ═══ */}
        {hasSummary && (
          <View>
            {hasVocab && <View style={s.thinRule} />}
            <Text style={s.secTitle}>Key Summary</Text>
            <View style={s.summaryBox}>
              {summaryLines.map((line, i) => (
                <Text key={i} style={s.summaryLine}>{line}</Text>
              ))}
            </View>
          </View>
        )}

        {/* ═══ 3. Structure ═══ */}
        {hasStructure && (
          <View>
            {(hasVocab || hasSummary) && <View style={s.thinRule} />}
            <Text style={s.secTitle}>Structure</Text>
            <View style={s.structureBox}>
              {structure.map((step, idx) => (
                <View key={step.step} style={s.structItem}>
                  <Text style={s.structText}>{step.one_line}</Text>
                  {idx < structure.length - 1 && <Text style={s.structArrow}>↓</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ 4. Topic / Title / Summary ═══ */}
        {hasExam && (
          <View>
            {(hasVocab || hasSummary || hasStructure) && <View style={s.thinRule} />}

            <Text style={s.fieldLabel}>Topic</Text>
            <Text style={s.fieldEn}>{examBlock.topic}</Text>
            {examBlock.topic_ko && <Text style={s.fieldKo}>{examBlock.topic_ko}</Text>}

            <Text style={s.fieldLabel}>Title</Text>
            <Text style={s.fieldEnTitle}>{examBlock.title}</Text>
            {examBlock.title_ko && <Text style={s.fieldKo}>{examBlock.title_ko}</Text>}

            <Text style={s.fieldLabel}>Summary</Text>
            <Text style={s.fieldEn}>{examBlock.one_sentence_summary}</Text>
            {examBlock.one_sentence_summary_ko && <Text style={s.fieldKo}>{examBlock.one_sentence_summary_ko}</Text>}
          </View>
        )}

      </Page>
    </Document>
  );
}
