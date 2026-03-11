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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

      // Try direct download first
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Fallback: open data URL in new tab (for iframe sandbox environments)
      const dataUrl = await blobToDataUrl(blob);
      window.open(dataUrl, "_blank");

      setTimeout(() => URL.revokeObjectURL(url), 30000);
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
      return blobToDataUrl(blob);
    },
    []
  );

  return { exportToPdf, previewPdf };
}
