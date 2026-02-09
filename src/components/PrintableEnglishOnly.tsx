import { forwardRef } from "react";
import { Chunk } from "@/lib/chunk-utils";

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
}

interface PrintableEnglishOnlyProps {
  results: SentenceResult[];
  title?: string;
}

function renderChunksWithSlash(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(" / ");
}

export const PrintableEnglishOnly = forwardRef<HTMLDivElement, PrintableEnglishOnlyProps>(
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
          fontSize: "7pt",
          lineHeight: "1.8"
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
            <div key={result.id} style={{ marginBottom: "14pt" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8pt" }}>
                {/* Circled number */}
                <span 
                  style={{ 
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "12pt",
                    height: "12pt",
                    backgroundColor: "#000",
                    color: "#fff",
                    borderRadius: "50%",
                    fontSize: "6pt",
                    fontWeight: 600,
                    flexShrink: 0,
                    marginTop: "1pt"
                  }}
                >
                  {index + 1}
                </span>
                <p style={{ 
                  fontFamily: "'Noto Serif', Georgia, serif", 
                  fontSize: "7pt",
                  lineHeight: "1.8",
                  margin: 0
                }}>
                  {result.englishChunks.length > 0 
                    ? renderChunksWithSlash(result.englishChunks)
                    : result.original
                  }
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

PrintableEnglishOnly.displayName = "PrintableEnglishOnly";
