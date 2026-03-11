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
      const win = window.open("", "_blank");
      try {
        const pdfDocument = createElement(PdfDocument, { results, title, subtitle });
        const blob = await pdf(pdfDocument).toBlob();
        const dataUrl = await blobToDataUrl(blob);
        if (win) {
          win.location.href = dataUrl;
        }
      } catch (err) {
        win?.close();
        throw err;
      }
    },
    []
  );

  const previewPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      subtitle: string
    ) => {
      const win = window.open("", "_blank");
      try {
        const pdfDocument = createElement(PdfDocument, { results, title, subtitle });
        const blob = await pdf(pdfDocument).toBlob();
        const dataUrl = await blobToDataUrl(blob);
        if (win) {
          win.location.href = dataUrl;
        }
      } catch (err) {
        win?.close();
        throw err;
      }
    },
    []
  );

  return { exportToPdf, previewPdf };
}
