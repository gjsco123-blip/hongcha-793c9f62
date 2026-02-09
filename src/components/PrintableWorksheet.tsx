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
  subtitle?: string;
}

function renderChunksWithSlash(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(" / ");
}

function CircledNumber({ num }: { num: number }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      border: "1px solid #333",
      fontSize: "8px",
      fontWeight: 600,
      marginRight: "3px",
      verticalAlign: "middle",
      lineHeight: 1
    }}>
      {num}
    </span>
  );
}

export const PrintableWorksheet = forwardRef<HTMLDivElement, PrintableWorksheetProps>(
  ({ results, title = "SYNTAX", subtitle = "문장 해석 연습" }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white"
        style={{ 
          width: "210mm", 
          minHeight: "297mm", 
          padding: "30mm 20mm",
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "9pt",
          lineHeight: "1.8"
        }}
      >
        {/* Header - 간소화 */}
        <div className="mb-8 border-b-2 border-black pb-4">
          <h1 style={{ fontSize: "16pt", fontWeight: "bold", letterSpacing: "0.05em", margin: 0 }}>
            {title}
          </h1>
          <p style={{ fontSize: "9pt", color: "#666", marginTop: "4pt" }}>
            {subtitle}
          </p>
        </div>

        {/* Sentences */}
        <div>
          {results.map((result, index) => (
            <div key={result.id} style={{ marginBottom: "20pt", paddingBottom: "12pt", borderBottom: "1px solid #ddd" }}>
              {/* Number + English sentence with chunks */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10pt", marginBottom: "6pt" }}>
                <span 
                  style={{ 
                    fontSize: "9pt",
                    fontWeight: 600,
                    flexShrink: 0,
                    minWidth: "20pt"
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p style={{ 
                  fontFamily: "'Noto Serif', Georgia, serif", 
                  fontSize: "9pt",
                  lineHeight: "1.8",
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
                    fontSize: "8pt", 
                    color: "#333", 
                    lineHeight: "1.6",
                    marginBottom: "4pt"
                  }}>
                    <span style={{ fontWeight: 600, marginRight: "8pt" }}>직역</span>
                    {renderChunksWithSlash(result.koreanLiteralChunks)}
                  </p>

                  {/* 의역 with label */}
                  <p style={{ 
                    fontSize: "8pt", 
                    color: "#333", 
                    lineHeight: "1.6",
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

        {/* 지문 Section - 슬래시 제거, 양쪽 정렬, 번호만 */}
        <div style={{ marginTop: "30pt", paddingTop: "20pt", borderTop: "2px solid #000" }}>
          <div style={{ fontSize: "10pt", fontWeight: 600, marginBottom: "12pt" }}>지문</div>
          <p style={{ 
            fontFamily: "'Noto Serif', Georgia, serif", 
            fontSize: "9pt",
            lineHeight: "2",
            margin: 0,
            textAlign: "justify"
          }}>
            {results.map((result, index) => (
              <span key={result.id}>
                <span style={{ fontWeight: 600, fontSize: "7pt", verticalAlign: "0.3em", marginRight: "2px" }}>{index + 1}</span>
                {" "}
                {result.original}
                {" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = "PrintableWorksheet";
