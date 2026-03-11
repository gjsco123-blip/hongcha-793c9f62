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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      triggerDownload(blob, filename);
    },
    []
  );

  const previewPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      subtitle: string
    ): Promise<string> => {
      const pdfDocument = createElement(PdfDocument, { results, title, subtitle });
      const blob = await pdf(pdfDocument).toBlob();
      return URL.createObjectURL(blob);
    },
    []
  );

  return { exportToPdf, previewPdf };
}
