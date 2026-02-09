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

function renderChunksWithSlash(chunks: Chunk[]): string {
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
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10pt", marginBottom: "8pt" }}>
                <span 
                  style={{ 
                    fontSize: "11pt",
                    fontWeight: 600,
                    flexShrink: 0,
                    minWidth: "20pt"
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
                    ? renderChunksWithSlash(result.englishChunks)
                    : result.original
                  }
                </p>
              </div>

              {result.englishChunks.length > 0 && (
                <div style={{ marginLeft: "30pt" }}>
                  {/* 직역 with label and chunks */}
                  <p style={{ 
                    fontSize: "11pt", 
                    color: "#333", 
                    lineHeight: "2",
                    margin: "0 0 4pt 0"
                  }}>
                    <span style={{ fontWeight: 600, marginRight: "8pt" }}>직역</span>
                    {renderChunksWithSlash(result.koreanLiteralChunks)}
                  </p>

                  {/* 의역 with label */}
                  <p style={{ 
                    fontSize: "11pt", 
                    color: "#333", 
                    lineHeight: "2",
                    margin: 0
                  }}>
                    <span style={{ fontWeight: 600, marginRight: "8pt" }}>의역</span>
                    {result.koreanNatural}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = "PrintableWorksheet";
