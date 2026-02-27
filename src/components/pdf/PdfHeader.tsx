import { View, Text, StyleSheet } from "@react-pdf/renderer";

/**
 * Shared PDF header for Preview & Analysis PDFs.
 * Uses a FIXED-HEIGHT title box so the rule position is
 * independent of font metrics / lineHeight differences.
 */

// ── Shared constants ──
const TITLE_BOX_HEIGHT = 22; // fixed box that contains the title text
const RULE_TOP_OFFSET = 5.5; // gap between title box bottom → rule top
const RULE_THICKNESS = 1.5;
const HEADER_MARGIN_TOP = -14;
const HEADER_MARGIN_BOTTOM = 16;

const styles = StyleSheet.create({
  wrapper: {
    marginTop: HEADER_MARGIN_TOP,
    marginBottom: HEADER_MARGIN_BOTTOM,
  },
  titleBox: {
    height: TITLE_BOX_HEIGHT,
    justifyContent: "flex-end" as const,
  },
  title: {
    fontFamily: "Pretendard",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
    lineHeight: 1,
    margin: 0,
    padding: 0,
  },
  rule: {
    height: RULE_THICKNESS,
    marginTop: RULE_TOP_OFFSET,
  },
});

interface PdfHeaderProps {
  title: string;
  /** Title text colour  (Preview=#222, Analysis=#666) */
  titleColor?: string;
  /** Rule colour          (Preview=#000, Analysis=#666) */
  ruleColor?: string;
}

export function PdfHeader({ title, titleColor = "#222", ruleColor = "#000" }: PdfHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.titleBox}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      </View>
      <View style={[styles.rule, { backgroundColor: ruleColor }]} />
    </View>
  );
}
