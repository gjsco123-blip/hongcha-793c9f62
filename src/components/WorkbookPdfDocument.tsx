import {
  Canvas,
  Document,
  Font,
  Line,
  Page,
  Svg,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

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

Font.registerHyphenationCallback((word) => [word]);

interface SentenceResult {
  id: number;
  original: string;
}

interface ExamBlock {
  topic?: string;
  title?: string;
  one_sentence_summary?: string;
}

interface WorkbookPdfDocumentProps {
  results: SentenceResult[];
  title: string;
  examBlock?: ExamBlock | null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 24,
    paddingLeft: 30,
    paddingRight: 30,
    fontFamily: "Pretendard",
    flexDirection: "column",
  },
  body: {
    flexGrow: 1,
    position: "relative",
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "#222",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  gridLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  gridSvg: {
    width: "100%",
    height: "100%",
  },
  contentLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: 18,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10,
  },
  textLayer: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 6,
    marginBottom: 0,
  },
  title: {
    fontSize: 8,
    fontWeight: 700,
    color: "#111",
  },
  arcCanvas: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: 595.28,  // A4 width in pt
    height: 841.89, // A4 height in pt
  },
  sentenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  sentenceRowCompact: {
    marginBottom: 11,
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginTop: 0,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: "Helvetica",
    color: "#fff",
    fontSize: 6.3,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  sentenceText: {
    fontFamily: "Helvetica",
    flex: 1,
    fontSize: 9.5,
    fontWeight: 600,
    color: "#111",
    lineHeight: 3.5,
  },
  sentenceTextCompact: {
    fontSize: 9.2,
    lineHeight: 3.0,
  },
  analysisSection: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  analysisItem: {
    marginBottom: 13.5,
  },
  analysisBar: {
    position: "absolute",
    left: 0,
    // Trim line-box padding so the bar visually aligns to text top/bottom.
    top: 1.5,
    bottom: 1.5,
    width: 2,
    backgroundColor: "#111",
  },
  analysisContentWrap: {
    position: "relative",
    paddingLeft: 9,
  },
  analysisLabel: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    fontWeight: 800,
    color: "#111",
    letterSpacing: 0.3,
    lineHeight: 1.2,
    marginBottom: 1.5,
  },
  analysisText: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    fontWeight: 400,
    color: "#111",
    lineHeight: 1.6,
  },
});

// Per-letter optical corrections (2-axis: normal + tangent).
// normalOffset: push toward border (negative = closer). R is reference (0,0).
// tangentOffset: shift along path direction.
const LETTER_METRICS: { char: string; normalOffset: number; tangentOffset: number }[] = [
  { char: "W", normalOffset: 0,   tangentOffset: 0 },
  { char: "O", normalOffset: 0,   tangentOffset: 0 },
  { char: "R", normalOffset: 0,   tangentOffset: 0 },   // ★ REFERENCE
  { char: "K", normalOffset: 0,   tangentOffset: 0 },
  { char: "B", normalOffset: 0,   tangentOffset: 0 },
  { char: "O", normalOffset: 0,   tangentOffset: 0 },
  { char: "O", normalOffset: 0,   tangentOffset: 0 },
  { char: "K", normalOffset: 0,   tangentOffset: 0 },
];

interface ArcPoint {
  char: string;
  // Page-space coordinates of the point ON the path (border + baseOffset)
  px: number;
  py: number;
  // Rotation in degrees (CW, for pdfkit)
  rotation: number;
  // Outward normal unit vector
  nx: number;
  ny: number;
  // Tangent unit vector (along path direction)
  tx: number;
  ty: number;
  // Per-letter offsets
  normalOffset: number;
  tangentOffset: number;
}

function getArcPoints(): ArcPoint[] {
  const text = "WORKBOOK";
  const letters = text.split("");

  const pagePadLeft = 30;
  const pagePadTop = 30;
  const headerHeight = 14;
  const bodyWidth = 535;
  const borderRadius = 18;
  const borderW = 0.6;

  const bodyTop = pagePadTop + headerHeight;
  const bodyRight = pagePadLeft + bodyWidth;

  // Base offset from border edge to letter center
  const baseOffset = borderW + 1.5;

  // Arc center (page coords)
  const cx = bodyRight - borderRadius;
  const cy = bodyTop + borderRadius;

  // Segment 1: top straight line, moving right
  const topStartX = cx - 50;
  const topEndX = cx;

  // Segment 2: corner arc (90°, from -90° to 0°)
  const arcRadius = borderRadius + baseOffset;

  // Segment 3: right straight line, moving down
  const rightStartY = cy;
  const rightEndY = cy + 50;

  // Segment lengths
  const seg1Len = topEndX - topStartX;
  const seg2Len = (Math.PI / 2) * arcRadius;
  const seg3Len = rightEndY - rightStartY;
  const totalLen = seg1Len + seg2Len + seg3Len;

  // Equal spacing
  const spacing = totalLen / (letters.length + 1);

  return letters.map((char, i) => {
    const d = spacing * (i + 1);
    const m = LETTER_METRICS[i] || { normalOffset: 0, tangentOffset: 0 };

    let px: number, py: number, rotation: number;
    let nx: number, ny: number;
    let tx: number, ty: number;

    if (d <= seg1Len) {
      px = topStartX + d;
      py = bodyTop;
      rotation = 0;
      nx = 0; ny = -1;
      tx = 1; ty = 0;
    } else if (d <= seg1Len + seg2Len) {
      const arcD = d - seg1Len;
      const angleDeg = -90 + (arcD / seg2Len) * 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      px = cx + borderRadius * Math.cos(angleRad);
      py = cy + borderRadius * Math.sin(angleRad);
      rotation = angleDeg + 90;
      nx = Math.cos(angleRad);
      ny = Math.sin(angleRad);
      // Tangent is 90° CCW from normal for CW arc
      tx = -ny; ty = nx;
    } else {
      const straightD = d - seg1Len - seg2Len;
      px = bodyRight;
      py = rightStartY + straightD;
      rotation = 90;
      nx = 1; ny = 0;
      tx = 0; ty = 1;
    }

    // Move outward from border by baseOffset
    px += nx * baseOffset;
    py += ny * baseOffset;

    return {
      char,
      px, py,
      rotation,
      nx, ny,
      tx, ty,
      normalOffset: m.normalOffset,
      tangentOffset: m.tangentOffset,
    };
  });
}

export function WorkbookPdfDocument({ results, title, examBlock }: WorkbookPdfDocumentProps) {
  const topic = (examBlock?.topic || "").trim();
  const heading = (examBlock?.title || "").trim();
  const summary = (examBlock?.one_sentence_summary || "").trim();
  const hasAnalysis = Boolean(topic || heading || summary);
  const totalChars = results.reduce((acc, cur) => acc + (cur.original?.length || 0), 0);
  const gridStep = 22;
  const gridStart = -22;
  const gridWidth = 560;
  const gridHeight = 740;
  const horizontalLines = Array.from(
    { length: Math.floor((gridHeight - gridStart) / gridStep) + 2 },
    (_, i) => gridStart + i * gridStep
  );
  const verticalLines = Array.from(
    { length: Math.floor((gridWidth - gridStart) / gridStep) + 2 },
    (_, i) => gridStart + i * gridStep
  );
  const useCompactSentenceLayout = hasAnalysis && (results.length >= 9 || totalChars > 980);
  const sentenceBottomPad = hasAnalysis ? 185 : 0;
  const arcPoints = getArcPoints();

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.gridLayer}>
            <Svg style={styles.gridSvg} viewBox={`0 0 ${gridWidth} ${gridHeight}`} preserveAspectRatio="none">
              {horizontalLines.map((y) => (
                <Line
                  key={`h-${y}`}
                  x1={0}
                  y1={y}
                  x2={gridWidth}
                  y2={y}
                  stroke="#cfcfcf"
                  strokeWidth={0.4}
                  strokeDasharray="3.2 5.2"
                />
              ))}
              {verticalLines.map((x) => (
                <Line
                  key={`v-${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={gridHeight}
                  stroke="#cfcfcf"
                  strokeWidth={0.4}
                  strokeDasharray="3.2 5.2"
                />
              ))}
            </Svg>
          </View>

          <View style={styles.contentLayer}>
            <View style={[styles.textLayer, { paddingBottom: sentenceBottomPad }]}>
              {results.map((result, index) => (
                <View
                  key={result.id}
                  style={[
                    styles.sentenceRow,
                    useCompactSentenceLayout ? styles.sentenceRowCompact : null,
                  ]}
                  wrap={false}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                  <Text
                    style={[
                      styles.sentenceText,
                      useCompactSentenceLayout ? styles.sentenceTextCompact : null,
                    ]}
                  >
                    {result.original}
                  </Text>
                </View>
              ))}
            </View>

            {hasAnalysis && (
              <View style={styles.analysisSection}>
                {topic ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>TOPIC</Text>
                      <Text style={styles.analysisText}>{topic}</Text>
                    </View>
                  </View>
                ) : null}
                {heading ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>TITLE</Text>
                      <Text style={styles.analysisText}>{heading}</Text>
                    </View>
                  </View>
                ) : null}
                {summary ? (
                  <View style={styles.analysisItem}>
                    <View style={styles.analysisContentWrap}>
                      <View style={styles.analysisBar} />
                      <Text style={styles.analysisLabel}>SUMMARY</Text>
                      <Text style={styles.analysisText}>{summary}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* Curved "WORKBOOK" text - Canvas-based for precise rotation origin control */}
        <Canvas
          style={styles.arcCanvas}
          paint={(painter) => {
            const fontSize = 6.5;
            painter.fontSize(fontSize);
            painter.font("Helvetica-Bold");
            painter.fillColor("#111");

            for (const pt of arcPoints) {
              // Final position = path point + normal/tangent offsets
              const fx = pt.px + pt.nx * pt.normalOffset + pt.tx * pt.tangentOffset;
              const fy = pt.py + pt.ny * pt.normalOffset + pt.ty * pt.tangentOffset;

              // Measure actual glyph width for centering
              const w = painter.widthOfString(pt.char);

              painter.save();
              // Translate to the target point, rotate around IT, then draw centered
              painter.translate(fx, fy);
              painter.rotate(pt.rotation, { origin: [0, 0] });
              // Draw text centered on origin: shift left by half-width, up by half-height
              painter.text(pt.char, -w / 2, -fontSize / 2, {
                width: w + 2,
                align: "left",
                lineBreak: false,
              });
              painter.restore();
            }

            return null;
          }}
        />
      </Page>
    </Document>
  );
}
