import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import { Chunk, segmentsToWords } from '@/lib/chunk-utils';

Font.register({
  family: 'Nanum Gothic',
  fonts: [
    { src: 'https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Regular.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Bold.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Noto Serif',
  src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-400-normal.ttf',
});

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: string;
}

interface PdfDocumentProps {
  results: SentenceResult[];
  title: string;
  subtitle: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 85,
    paddingLeft: 57,
    paddingRight: 57,
    fontFamily: 'Nanum Gothic',
    fontSize: 9,
    lineHeight: 1.8,
  },
  header: {
    marginTop: -14,
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
  },
  sentenceContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  sentenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  sentenceNumber: {
    fontSize: 9,
    fontWeight: 700,
    width: 20,
    flexShrink: 0,
  },
  englishText: {
    fontFamily: 'Noto Serif',
    fontSize: 9,
    lineHeight: 1.8,
    flex: 1,
  },
  translationContainer: {
    marginLeft: 28,
  },
  translationRow: {
    fontSize: 8,
    color: '#333',
    lineHeight: 1.6,
    marginBottom: 3,
  },
  translationLabel: {
    fontWeight: 700,
    marginRight: 8,
  },
  passageSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  passageSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 12,
  },
  passageText: {
    fontFamily: 'Noto Serif',
    fontSize: 9,
    lineHeight: 2,
    textAlign: 'justify',
  },
  passageNumber: {
    fontWeight: 700,
    fontSize: 7,
    verticalAlign: 'super',
    marginRight: 2,
    color: '#000',
  },
  verbUnderline: {
    textDecoration: 'underline',
  },
});

/** Render chunks with slash, applying underline to verbs */
function renderChunksWithVerbUnderline(chunks: Chunk[]) {
  const elements: React.ReactNode[] = [];

  chunks.forEach((chunk, ci) => {
    const words = segmentsToWords(chunk.segments);
    words.forEach((w, wi) => {
      const prefix = wi > 0 ? ' ' : '';
      if (w.isVerb) {
        if (prefix) {
          elements.push(<Text key={`${ci}-${wi}-sp`}>{prefix}</Text>);
        }
        elements.push(
          <Text key={`${ci}-${wi}`} style={styles.verbUnderline}>
            {w.word}
          </Text>
        );
      } else {
        elements.push(
          <Text key={`${ci}-${wi}`}>
            {prefix}{w.word}
          </Text>
        );
      }
    });
    if (ci < chunks.length - 1) {
      elements.push(<Text key={`slash-${ci}`}> / </Text>);
    }
  });

  return elements;
}

function renderChunksSlashPlain(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(' / ');
}

export function PdfDocument({ results, title, subtitle }: PdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {results.map((result, index) => (
          <View key={result.id} style={styles.sentenceContainer} wrap={false}>
            <View style={styles.sentenceRow}>
              <Text style={styles.sentenceNumber}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.englishText}>
                {result.englishChunks.length > 0
                  ? renderChunksWithVerbUnderline(result.englishChunks)
                  : result.original}
              </Text>
            </View>

            {result.englishChunks.length > 0 && (
              <View style={styles.translationContainer}>
                <Text style={styles.translationRow}>
                  <Text style={styles.translationLabel}>직역 </Text>
                  {renderChunksSlashPlain(result.koreanLiteralChunks)}
                </Text>
                <Text style={styles.translationRow}>
                  <Text style={styles.translationLabel}>의역 </Text>
                  {result.koreanNatural}
                </Text>
                {result.syntaxNotes ? (
                  <Text style={styles.translationRow}>
                    <Text style={styles.translationLabel}>구문 </Text>
                    {result.syntaxNotes}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ))}

        {/* 지문 섹션 - 밑줄 없이 원문만 */}
        <View style={styles.passageSection} wrap={false}>
          <Text style={styles.passageSectionTitle}>Original Passage</Text>
          <Text style={styles.passageText}>
            {results.map((result, index) => (
              <Text key={result.id}>
                <Text style={styles.passageNumber}>{index + 1}</Text>
                {' '}{result.original}{' '}
              </Text>
            ))}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
