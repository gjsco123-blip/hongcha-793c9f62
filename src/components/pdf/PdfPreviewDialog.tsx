import { useEffect, useRef, useState } from "react";
import { FileDown, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Vite resolves this to a hashed asset URL; ensures worker is bundled (no CDN, no sandbox issues)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure worker once at module load
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfPreviewDialogProps {
  /** PDF Blob to render. When null, dialog is closed. */
  blob: Blob | null;
  onClose: () => void;
  /** Triggered when user clicks the download button in the header. */
  onDownload: () => void;
  title?: string;
}

/**
 * In-app PDF preview using pdf.js → canvas rendering.
 * Avoids `<iframe src=dataURL>` which is unreliable inside Lovable's nested
 * sandbox iframe (browser PDF plugin gets blocked → blank page).
 */
export function PdfPreviewDialog({
  blob,
  onClose,
  onDownload,
  title = "PDF 미리보기",
}: PdfPreviewDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!blob) {
      setPageCount(0);
      setError(null);
      return;
    }

    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    let pdfDoc: PDFDocumentProxy | null = null;

    const render = async () => {
      setLoading(true);
      setError(null);
      try {
        const buf = await blob.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        setPageCount(pdfDoc.numPages);
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const containerWidth = container.clientWidth - 32; // padding allowance
        const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(1, containerWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px auto";
          canvas.style.boxShadow = "0 1px 3px hsl(var(--foreground) / 0.15)";
          canvas.style.background = "white";
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.scale(dpr, dpr);

          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "PDF 렌더 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();

    return () => {
      cancelled = true;
      if (pdfDoc) pdfDoc.destroy().catch(() => {});
      if (loadingTask) loadingTask.destroy().catch(() => {});
    };
  }, [blob]);

  return (
    <Dialog open={!!blob} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
          <span className="text-sm font-medium">
            {title}
            {pageCount > 0 && (
              <span className="ml-2 text-muted-foreground text-xs">{pageCount}p</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> 다운로드
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-muted/40 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2 pointer-events-none">
              <Loader2 className="w-4 h-4 animate-spin" /> 렌더링 중...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm px-4 text-center">
              PDF 미리보기 실패: {error}
            </div>
          )}
          <div ref={containerRef} className="py-4 px-4 min-h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}