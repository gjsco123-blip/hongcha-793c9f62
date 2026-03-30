import { useCallback, createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { mergePdfBlobs } from "@/hooks/usePdfExport";
import { PdfDocument } from "@/components/PdfDocument";
import { PreviewPdf } from "@/components/PreviewPdf";
import { WorkbookPdfDocument } from "@/components/WorkbookPdfDocument";
import { parsePassageStore, PassageStorePayload } from "@/lib/passage-store";
import type { Passage } from "@/hooks/useCategories";

type PdfType = "syntax" | "preview" | "combined" | "workbook";

interface ValidationError {
  passageName: string;
  missing: string;
}

function validatePassages(
  selected: Passage[],
  type: PdfType
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const p of selected) {
    const store = parsePassageStore(p.results_json);
    const hasSyntax = Array.isArray(store.syntaxResults) && store.syntaxResults.length > 0;
    const hasPreview =
      store.preview &&
      ((Array.isArray(store.preview.vocab) && store.preview.vocab.length > 0) ||
        (Array.isArray(store.preview.synonyms) && store.preview.synonyms.length > 0) ||
        (typeof store.preview.summary === "string" && store.preview.summary.length > 0));

    if (type === "syntax" && !hasSyntax) {
      errors.push({ passageName: p.name, missing: "구문분석 결과 없음" });
    } else if (type === "preview" && !hasPreview) {
      errors.push({ passageName: p.name, missing: "Preview 데이터 없음" });
    } else if (type === "combined") {
      if (!hasSyntax && !hasPreview) {
        errors.push({ passageName: p.name, missing: "구문분석 결과 + Preview 데이터 없음" });
      } else if (!hasSyntax) {
        errors.push({ passageName: p.name, missing: "구문분석 결과 없음" });
      } else if (!hasPreview) {
        errors.push({ passageName: p.name, missing: "Preview 데이터 없음" });
      }
    } else if (type === "workbook" && !hasSyntax) {
      errors.push({ passageName: p.name, missing: "구문분석 결과 없음 (워크북용)" });
    }
  }
  return errors;
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

export function useBatchPdfExport() {
  const batchExportSyntax = useCallback(
    async (passages: Passage[], selectedIds: Set<string>, schoolName: string, teacherLabel?: string) => {
      const selected = passages
        .filter((p) => selectedIds.has(p.id))
        .sort((a, b) => a.sort_order - b.sort_order);

      const errors = validatePassages(selected, "syntax");
      if (errors.length > 0) {
        const msg = errors.map((e) => `• "${e.passageName}": ${e.missing}`).join("\n");
        alert(`다음 지문에 데이터가 없습니다:\n${msg}\n\n해당 지문의 데이터를 먼저 생성해주세요.`);
        return;
      }

      const blobs: Blob[] = [];
      for (const p of selected) {
        const store = parsePassageStore(p.results_json);
        const title = p.pdf_title || "SYNTAX";
        const doc = createElement(PdfDocument, {
          results: store.syntaxResults as any[],
          title,
          subtitle: p.name,
          teacherLabel,
        });
        blobs.push(await pdf(doc).toBlob());
      }
      const merged = await mergePdfBlobs(blobs);
      triggerDownload(merged, `${schoolName}_구문분석.pdf`);
    },
    []
  );

  const batchExportPreview = useCallback(
    async (passages: Passage[], selectedIds: Set<string>, schoolName: string) => {
      const selected = passages
        .filter((p) => selectedIds.has(p.id))
        .sort((a, b) => a.sort_order - b.sort_order);

      const errors = validatePassages(selected, "preview");
      if (errors.length > 0) {
        const msg = errors.map((e) => `• "${e.passageName}": ${e.missing}`).join("\n");
        alert(`다음 지문에 데이터가 없습니다:\n${msg}\n\n해당 지문의 데이터를 먼저 생성해주세요.`);
        return;
      }

      const blobs: Blob[] = [];
      for (const p of selected) {
        const store = parsePassageStore(p.results_json);
        const prev = store.preview!;
        const doc = createElement(PreviewPdf, {
          vocab: (prev.vocab || []) as any[],
          synonyms: (prev.synonyms || []) as any[],
          summary: (prev.summary || "") as string,
          examBlock: (prev.examBlock || null) as any,
          title: (prev.pdfTitle || p.pdf_title || p.name) as string,
        });
        blobs.push(await pdf(doc).toBlob());
      }
      const merged = await mergePdfBlobs(blobs);
      triggerDownload(merged, `${schoolName}_Preview.pdf`);
    },
    []
  );

  const batchExportCombined = useCallback(
    async (passages: Passage[], selectedIds: Set<string>, schoolName: string, teacherLabel?: string) => {
      const selected = passages
        .filter((p) => selectedIds.has(p.id))
        .sort((a, b) => a.sort_order - b.sort_order);

      const errors = validatePassages(selected, "combined");
      if (errors.length > 0) {
        const msg = errors.map((e) => `• "${e.passageName}": ${e.missing}`).join("\n");
        alert(`다음 지문에 데이터가 없습니다:\n${msg}\n\n해당 지문의 데이터를 먼저 생성해주세요.`);
        return;
      }

      // For each passage: preview first, then syntax
      const blobs: Blob[] = [];
      for (const p of selected) {
        const store = parsePassageStore(p.results_json);
        const prev = store.preview!;
        const title = p.pdf_title || "SYNTAX";

        const previewDoc = createElement(PreviewPdf, {
          vocab: (prev.vocab || []) as any[],
          synonyms: (prev.synonyms || []) as any[],
          summary: (prev.summary || "") as string,
          examBlock: (prev.examBlock || null) as any,
          title: (prev.pdfTitle || title) as string,
        });
        blobs.push(await pdf(previewDoc).toBlob());

        const syntaxDoc = createElement(PdfDocument, {
          results: store.syntaxResults as any[],
          title,
          subtitle: p.name,
          teacherLabel,
        });
        blobs.push(await pdf(syntaxDoc).toBlob());
      }
      const merged = await mergePdfBlobs(blobs);
      triggerDownload(merged, `${schoolName}_통합.pdf`);
    },
    []
  );

  const batchExportWorkbook = useCallback(
    async (passages: Passage[], selectedIds: Set<string>, schoolName: string) => {
      const selected = passages
        .filter((p) => selectedIds.has(p.id))
        .sort((a, b) => a.sort_order - b.sort_order);

      const errors = validatePassages(selected, "workbook");
      if (errors.length > 0) {
        const msg = errors.map((e) => `• "${e.passageName}": ${e.missing}`).join("\n");
        alert(`다음 지문에 데이터가 없습니다:\n${msg}\n\n해당 지문의 데이터를 먼저 생성해주세요.`);
        return;
      }

      const blobs: Blob[] = [];
      for (const p of selected) {
        const store = parsePassageStore(p.results_json);
        const title = p.pdf_title || "SYNTAX";
        const examBlock = store.preview?.examBlock as any;
        const doc = createElement(WorkbookPdfDocument, {
          results: store.syntaxResults as any[],
          title,
          examBlock: examBlock || null,
        });
        blobs.push(await pdf(doc).toBlob());
      }
      const merged = await mergePdfBlobs(blobs);
      triggerDownload(merged, `${schoolName}_워크북.pdf`);
    },
    []
  );

  return { batchExportSyntax, batchExportPreview, batchExportCombined, batchExportWorkbook };
}
