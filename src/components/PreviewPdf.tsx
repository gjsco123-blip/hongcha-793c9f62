import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/PdfHeader";
import { getDisplaySummary } from "@/lib/exam-block";

// ── Font Registration ──
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
    {
      src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf",
      fontWeight: 800,
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

Font.register({
  family: "Jua",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/jua@latest/korean-400-normal.ttf",
});

Font.registerHyphenationCallback((word) => [word]);

// ── Types ──
interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}
interface SynAntItem {
  word: string;
  synonym: string;
  antonym: string;
}
interface ExamBlock {
  topic_basic: string;
  topic_basic_ko?: string;
  topic_advanced: string;
  topic_advanced_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}
interface Props {
  vocab: VocabItem[];
  synonyms: SynAntItem[];
  summary: string;
  examBlock: ExamBlock | null;
  title?: string;
}

// ── Design tokens ──
const T = {
  ko: "Pretendard",
  en: "Pretendard",
  black: "#000000",
  g70: "#000000",
  g50: "#000000",
  g30: "#000000",
  g30text: "#000000",
  g10: "#f0f0f0",
  g05: "#f8f8f8",
  rule: "#d0d0d0",
  mH: 40,
  mT: 40,
  mB: 36,
};

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: T.mB,
    paddingLeft: T.mH,
    paddingRight: T.mH,
    fontFamily: T.ko,
    fontSize: 8.5,
    color: T.black,
  },
  secTitle: {
    fontSize: 7.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    color: T.g50,
    marginBottom: 6,
  },
  thinRule: { height: 0.5, backgroundColor: T.rule, marginVertical: 8 },
  notepadBox: {
    minHeight: 214,
    borderWidth: 1.5,
    borderColor: T.black,
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  notepadLabel: {
    fontSize: 7.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    color: T.black,
    marginBottom: 8,
  },
  notepadLine: {
    height: 18,
    borderBottomWidth: 0.6,
    borderBottomColor: T.black,
  },
  summaryBox: { borderLeftWidth: 2, borderLeftColor: T.g30, paddingLeft: 10, paddingVertical: 3 },
  summaryText: { fontSize: 8, lineHeight: 1.7 },
  // Synonyms & Antonyms table
  synTable: { borderWidth: 0.5, borderColor: T.rule },
  synHdr: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: 24,
    paddingVertical: 0,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: T.black,
  },
  synRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: "#e4e4e4",
  },
  synWord: {
    width: "21%" as any,
    fontSize: 7,
    fontWeight: 400,
    color: T.black,
    lineHeight: 1.3,
    borderRightWidth: 0.5,
    borderRightColor: T.rule,
    paddingRight: 4,
  },
  synSyn: {
    width: "46%" as any,
    fontSize: 6.5,
    fontWeight: 600,
    color: T.black,
    lineHeight: 1.45,
    paddingLeft: 4,
    paddingRight: 4,
  },
  synAnt: {
    width: "33%" as any,
    fontSize: 6.5,
    fontWeight: 600,
    color: T.black,
    lineHeight: 1.45,
    paddingLeft: 4,
    borderLeftWidth: 0.5,
    borderLeftColor: T.rule,
  },
  synHdrText: {
    fontSize: 7.5,
    fontWeight: 800,
    color: T.g50,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    lineHeight: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  synHdrSymbol: {
    fontSize: 10.5,
    fontWeight: 800,
    color: T.g50,
    lineHeight: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  fieldLabel: {
    fontSize: 7.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    color: T.g50,
    marginBottom: 3,
    marginTop: 12,
  },
  fieldEn: { fontFamily: T.en, fontSize: 8, color: T.black, lineHeight: 1.6 },
  fieldKo: { fontSize: 7, color: T.g70, lineHeight: 1.5, marginTop: 1.5 },
  topicRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 5 },
  topicLead: { width: 37, flexDirection: "row" as const, alignItems: "flex-start" as const },
  topicLeadLabelWrap: { width: 29 },
  topicLeadLabel: {
    fontSize: 8.5,
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1,
    backgroundColor: "#000000",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingTop: 3,
    paddingBottom: 4,
    textAlign: "center" as const,
    letterSpacing: 0.35,
  },
  topicInlineStack: { flex: 1 },
  topicInlineEn: { fontFamily: T.en, fontSize: 9, color: T.black, lineHeight: 1.6 },
  topicInlineKo: { fontSize: 7, color: T.g70, lineHeight: 1.5, marginTop: 1.5 },
  summaryRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 5 },
  summaryLead: { width: 37, flexDirection: "row" as const, alignItems: "flex-start" as const },
  summaryLeadLabelWrap: { width: 29 },
  summaryLeadLabel: {
    fontSize: 8.5,
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1,
    backgroundColor: "#000000",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingTop: 3,
    paddingBottom: 4,
    textAlign: "center" as const,
    letterSpacing: 0.35,
  },
  summaryInlineText: { flex: 1, fontSize: 8, color: T.black, lineHeight: 1.6 },
  summaryBlock: { marginTop: 14 },
});

export function PreviewPdf({ vocab, synonyms, summary, examBlock, title: titleProp }: Props) {
  const hasSynonyms = synonyms.length > 0;
  const hasSummary = !!summary;
  const hasExam = !!examBlock;
  const summaryLines = summary ? summary.split("\n").filter(Boolean) : [];
  const title = titleProp || "Preview";
  const summaryText = getDisplaySummary(examBlock);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader title={title} titleColor="#222" ruleColor="#000" />

        <View>
          <View style={s.notepadBox}>
            <Text style={s.notepadLabel}>Notepad</Text>
            {Array.from({ length: 10 }).map((_, idx) => (
              <View key={idx} style={s.notepadLine} />
            ))}
          </View>
        </View>

        {hasSummary && (
          <View>
            <View style={s.thinRule} />
            <Text style={s.secTitle}>Passage Logic</Text>
            <View style={s.summaryBox}>
              <Text style={s.summaryText}>{summaryLines.join("\n")}</Text>
            </View>
          </View>
        )}

        {hasSynonyms && (
          <View>
            <View style={s.thinRule} />

            <View style={s.synTable}>
              <View style={s.synHdr}>
                <Text style={{ ...s.synWord, ...s.synHdrText }}>Word</Text>
                <Text style={{ ...s.synSyn, ...s.synHdrSymbol, paddingLeft: 0, paddingRight: 0, textAlign: "center" }}>=</Text>
                <Text style={{ ...s.synAnt, ...s.synHdrSymbol, paddingLeft: 0, textAlign: "center" }}>≠</Text>
              </View>
              {synonyms.map((item, idx) => (
                <View key={idx} style={s.synRow}>
                  <Text style={s.synWord}>{item.word}</Text>
                  <Text style={s.synSyn}>{item.synonym}</Text>
                  <Text style={s.synAnt}>{item.antonym}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {hasExam && (
          <View>
            <View style={s.thinRule} />
            <View style={[s.topicRow, { marginTop: 4 }]}>
              <View style={s.topicLead}>
                <View style={s.topicLeadLabelWrap}>
                  <Text style={s.topicLeadLabel}>주제</Text>
                </View>
              </View>
              <View style={s.topicInlineStack}>
                <Text style={s.topicInlineEn}>{examBlock.topic_basic}</Text>
                {examBlock.topic_basic_ko && <Text style={s.topicInlineKo}>{examBlock.topic_basic_ko}</Text>}
              </View>
            </View>
            <View style={[s.topicRow, { marginTop: 6 }]}>
              <View style={s.topicLead}>
                <View style={s.topicLeadLabelWrap}></View>
              </View>
              <View style={s.topicInlineStack}>
                <Text style={s.topicInlineEn}>{examBlock.topic_advanced}</Text>
                {examBlock.topic_advanced_ko && <Text style={s.topicInlineKo}>{examBlock.topic_advanced_ko}</Text>}
              </View>
            </View>
            <View style={s.summaryBlock}>
              <View style={s.summaryRow}>
                <View style={s.summaryLead}>
                  <View style={s.summaryLeadLabelWrap}>
                    <Text style={s.summaryLeadLabel}>요약</Text>
                  </View>
                </View>
                <Text style={s.summaryInlineText}>{summaryText}</Text>
              </View>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
