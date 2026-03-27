import { useCallback, createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { PdfDocument } from "@/components/PdfDocument";
import { PreviewPdf } from "@/components/PreviewPdf";
import { WorkbookPdfDocument } from "@/components/WorkbookPdfDocument";
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

interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}

interface SynAntItem {
  word: string;
  synonym: string;
  antonym: string;
}

interface ExamBlock {
  topic: string;
  topic_ko?: string;
  title: string;
  title_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}

interface PreviewPayload {
  vocab: VocabItem[];
  synonyms: SynAntItem[];
  summary: string;
  examBlock: ExamBlock | null;
  title?: string;
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

async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const b of blobs) {
    const bytes = new Uint8Array(await b.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  const out = await merged.save();
  return new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function usePdfExport() {
  const exportToPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      subtitle: string,
      filename: string = "worksheet.pdf",
      teacherLabel?: string
    ) => {
      const pdfDocument = createElement(PdfDocument, { results, title, subtitle, teacherLabel });
      const blob = await pdf(pdfDocument).toBlob();
      triggerDownload(blob, filename);
    },
    []
  );

  const previewPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      subtitle: string,
      teacherLabel?: string
    ): Promise<string> => {
      const pdfDocument = createElement(PdfDocument, { results, title, subtitle, teacherLabel });
      const blob = await pdf(pdfDocument).toBlob();
      return URL.createObjectURL(blob);
    },
    []
  );

  const exportCombinedPdf = useCallback(
    async (
      previewData: PreviewPayload,
      syntaxResults: SentenceResult[],
      title: string,
      subtitle: string,
      filename: string = "worksheet-combined.pdf",
      teacherLabel?: string
    ) => {
      const previewDocument = createElement(PreviewPdf, {
        vocab: previewData.vocab,
        synonyms: previewData.synonyms,
        summary: previewData.summary,
        examBlock: previewData.examBlock,
        title: previewData.title || title,
      });
      const syntaxDocument = createElement(PdfDocument, { results: syntaxResults, title, subtitle, teacherLabel });
      const [previewBlob, syntaxBlob] = await Promise.all([
        pdf(previewDocument).toBlob(),
        pdf(syntaxDocument).toBlob(),
      ]);
      const mergedBlob = await mergePdfBlobs([previewBlob, syntaxBlob]);
      triggerDownload(mergedBlob, filename);
    },
    []
  );

  const exportWorkbookPdf = useCallback(
    async (
      results: SentenceResult[],
      title: string,
      examBlock?: ExamBlock | null,
      filename: string = "workbook.pdf",
    ) => {
      const workbookDocument = createElement(WorkbookPdfDocument, { results, title, examBlock });
      const blob = await pdf(workbookDocument).toBlob();
      triggerDownload(blob, filename);
    },
    []
  );

  return { exportToPdf, previewPdf, exportCombinedPdf, exportWorkbookPdf };
}
