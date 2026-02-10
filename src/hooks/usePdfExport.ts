import { useCallback, createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { PdfDocument } from "@/components/PdfDocument";
import { Chunk } from "@/lib/chunk-utils";

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: string;
  hongTNotes?: string;
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

      // 다운로드
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    []
  );

  return { exportToPdf };
}
