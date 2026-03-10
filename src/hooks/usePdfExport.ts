import { useCallback, createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { PdfDocument } from "@/components/PdfDocument";
import { Chunk } from "@/lib/chunk-utils";

interface SyntaxNote {
  id: number;
  content: string;
  targetText?: string;
}

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: SyntaxNote[];
  hongTNotes?: string;
  hideLiteral?: boolean;
  hideNatural?: boolean;
  hideHongT?: boolean;
}

export function usePdfExport() {
  const exportToPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      subtitle: string,
      filename: string = "worksheet.pdf"
    ) => {
      const pdfDocument = createElement(PdfDocument, { results, title, subtitle });
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
    []
  );

  return { exportToPdf };
}
