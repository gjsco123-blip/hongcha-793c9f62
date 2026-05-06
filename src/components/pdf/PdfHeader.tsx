import { View, Text, StyleSheet } from "@react-pdf/renderer";

/**
 * Shared PDF header for Preview & Analysis PDFs.
 * Uses a FIXED-HEIGHT title box so the rule position is
 * independent of font metrics / lineHeight differences.
 */

// ── Shared constants ──
const RULE_THICKNESS = 1.5;
const HEADER_MARGIN_TOP = -14;
const HEADER_MARGIN_BOTTOM = 16;

const styles = StyleSheet.create({
  wrapper: {
    marginTop: HEADER_MARGIN_TOP,
    marginBottom: HEADER_MARGIN_BOTTOM,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: "Pretendard",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
    lineHeight: 1,
    margin: 0,
    padding: 0,
    marginRight: 10,
  },
  rule: {
    flexGrow: 1,
    height: RULE_THICKNESS,
  },
});

interface PdfHeaderProps {
  title: string;
  /** Title text colour  (Preview=#222, Analysis=#777) */
  titleColor?: string;
  /** Rule colour          (Preview=#222, Analysis=#777) */
  ruleColor?: string;
}

export function PdfHeader({ title, titleColor = "#222", ruleColor = "#000" }: PdfHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <View style={[styles.rule, { backgroundColor: ruleColor }]} />
    </View>
  );
}
