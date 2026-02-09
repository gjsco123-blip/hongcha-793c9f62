import { forwardRef } from "react";
import { Chunk } from "@/lib/chunk-utils";

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
}

interface PrintableWorksheetProps {
  results: SentenceResult[];
  title?: string;
}

function renderChunksWithSlash(chunks: Chunk[], isEnglish: boolean = false): string {
  return chunks.map((c) => c.text).join(" / ");
}

export const PrintableWorksheet = forwardRef<HTMLDivElement, PrintableWorksheetProps>(
  ({ results, title = "SYNTAX" }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white"
        style={{ 
          width: "210mm", 
          minHeight: "297mm", 
          padding: "15mm 20mm",
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "11pt",
          lineHeight: "2"
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 border-b-2 border-black pb-4">
          <div className="bg-black text-white px-4 py-3 text-center">
            <div style={{ fontSize: "9pt", letterSpacing: "0.1em" }}>UNIT</div>
            <div style={{ fontSize: "20pt", fontWeight: "bold", lineHeight: 1 }}>01</div>
          </div>
          <div>
            <h1 style={{ fontSize: "16pt", fontWeight: "bold", letterSpacing: "0.05em" }}>{title}</h1>
            <p style={{ fontSize: "9pt", color: "#666" }}>문장 해석 연습</p>
          </div>
          <div className="flex-1" />
          <div style={{ fontSize: "9pt", color: "#666", textAlign: "right" }}>
            <div>이름: _______________</div>
            <div className="mt-1">날짜: _______________</div>
          </div>
        </div>

        {/* Sentences */}
        <div>
          {results.map((result, index) => (
            <div key={result.id} style={{ marginBottom: "24pt", paddingBottom: "16pt", borderBottom: "1px solid #ddd" }}>
              {/* Number + English sentence with chunks */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12pt", marginBottom: "8pt" }}>
                <span 
                  style={{ 
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24pt", 
                    height: "24pt", 
                    borderRadius: "50%", 
                    border: "1.5pt solid black",
                    fontSize: "10pt",
                    fontWeight: 600,
                    flexShrink: 0,
                    marginTop: "2pt"
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p style={{ 
                  fontFamily: "'Noto Serif', Georgia, serif", 
                  fontSize: "11pt",
                  lineHeight: "2",
                  margin: 0
                }}>
                  {result.englishChunks.length > 0 
                    ? renderChunksWithSlash(result.englishChunks, true)
                    : result.original
                  }
                </p>
              </div>

              {result.englishChunks.length > 0 && (
                <div style={{ marginLeft: "36pt" }}>
                  {/* 직역 with chunks */}
                  <p style={{ 
                    fontSize: "11pt", 
                    color: "#333", 
                    lineHeight: "2",
                    margin: "0 0 4pt 0"
                  }}>
                    {renderChunksWithSlash(result.koreanLiteralChunks)}
                  </p>

                  {/* 의역 */}
                  <p style={{ 
                    fontSize: "11pt", 
                    color: "#333", 
                    lineHeight: "2",
                    margin: 0
                  }}>
                    {result.koreanNatural}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div style={{ marginTop: "32pt", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16pt" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12pt" }}>
            <div style={{ border: "1pt solid #999", padding: "12pt", minHeight: "70pt" }}>
              <div style={{ fontSize: "10pt", marginBottom: "8pt" }}>
                <span style={{ fontWeight: 600 }}>Before</span>
                <span style={{ color: "#666", marginLeft: "8pt" }}>| 수업 전 스스로 해석 해보기</span>
              </div>
              <div style={{ height: "36pt", borderBottom: "1pt dashed #ccc" }} />
            </div>
            <div style={{ border: "1pt solid #999", padding: "12pt", minHeight: "70pt" }}>
              <div style={{ fontSize: "10pt", marginBottom: "8pt" }}>
                <span style={{ fontWeight: 600 }}>After</span>
                <span style={{ color: "#666", marginLeft: "8pt" }}>| 수업 후 해석해보고 비교하기</span>
              </div>
              <div style={{ height: "36pt", borderBottom: "1pt dashed #ccc" }} />
            </div>
          </div>
          <div style={{ border: "2pt solid black", padding: "12pt", minHeight: "152pt" }}>
            <div style={{ fontSize: "10pt", fontWeight: 600, marginBottom: "8pt" }}>MEMO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10pt" }}>
              <div style={{ height: "14pt", borderBottom: "1pt dashed #ccc" }} />
              <div style={{ height: "14pt", borderBottom: "1pt dashed #ccc" }} />
              <div style={{ height: "14pt", borderBottom: "1pt dashed #ccc" }} />
              <div style={{ height: "14pt", borderBottom: "1pt dashed #ccc" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = "PrintableWorksheet";
