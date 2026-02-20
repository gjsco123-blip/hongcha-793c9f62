import { useState, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, Loader2, FileDown, Eye } from "lucide-react";
import { PreviewPdf } from "@/components/PreviewPdf";

// ── Types ──
interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}

interface StructureStep {
  step: number;
  one_line: string;
  evidence: string;
}

interface ExamBlock {
  topic: string;
  topic_ko?: string;
  title: string;
  title_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}

type SectionStatus = "idle" | "loading" | "done" | "error";

async function invokeRetry(fn: string, body: any, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (!error && data && !data.error) return data;
    const isRetryable =
      error?.status === 429 || error?.status === 503 ||
      (typeof data?.error === "string" && /rate.?limit/i.test(data.error));
    if (isRetryable && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500 + Math.random() * 500));
      continue;
    }
    throw new Error(error?.message || data?.error || "Unknown error");
  }
  throw new Error("Max retries exceeded");
}

export default function Preview() {
  const navigate = useNavigate();
  const location = useLocation();
  const [passage, setPassage] = useState((location.state as any)?.passage || "");

  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [vocabStatus, setVocabStatus] = useState<SectionStatus>("idle");
  const [structure, setStructure] = useState<StructureStep[]>([]);
  const [structureStatus, setStructureStatus] = useState<SectionStatus>("idle");
  const [summary, setSummary] = useState("");
  const [examBlock, setExamBlock] = useState<ExamBlock | null>(null);
  const [previewStatus, setPreviewStatus] = useState<SectionStatus>("idle");

  const isGenerating = vocabStatus === "loading" || structureStatus === "loading" || previewStatus === "loading";

  const handleGenerate = async () => {
    if (!passage.trim() || isGenerating) return;
    setVocabStatus("loading");
    setStructureStatus("loading");
    setPreviewStatus("loading");

    const vocabPromise = invokeRetry("analyze-vocab", { passage, count: 20 })
      .then((d) => { setVocab(d.vocab || []); setVocabStatus("done"); })
      .catch((e) => { toast.error(`어휘 생성 실패: ${e.message}`); setVocabStatus("error"); });

    const structPromise = invokeRetry("analyze-structure", { passage, step_count: 5 })
      .then((d) => { setStructure((d.structure_steps || []).slice(0, 5)); setStructureStatus("done"); })
      .catch((e) => { toast.error(`구조 흐름 생성 실패: ${e.message}`); setStructureStatus("error"); });

    const previewPromise = invokeRetry("analyze-preview", { passage })
      .then((d) => { setSummary(d.summary || ""); setExamBlock(d.exam_block || null); setPreviewStatus("done"); })
      .catch((e) => { toast.error(`요약 생성 실패: ${e.message}`); setPreviewStatus("error"); });

    await Promise.allSettled([vocabPromise, structPromise, previewPromise]);
  };

  const handleExportPdf = async () => {
    try {
      const doc = createElement(PreviewPdf, { vocab, structure, summary, examBlock }) as any;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "preview.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF가 저장되었습니다.");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const canExport = vocab.length > 0 || structure.length > 0 || summary;
  const LoadingDot = () => <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />;

  /* ── Shared sub-label style ── */
  const subLabel = "text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1";
  const enText = "text-sm font-english leading-relaxed";
  const koText = "text-xs text-muted-foreground/70 mt-0.5";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Eye className="w-5 h-5" />
            <h1 className="text-xl font-bold tracking-wide">Preview</h1>
          </div>
          {canExport && (
            <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-4 py-2 border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors">
              <FileDown className="w-3.5 h-3.5" /> PDF 저장
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        {/* Input */}
        <div>
          <textarea value={passage} onChange={(e) => setPassage(e.target.value)} placeholder="영어 지문 전체를 붙여넣으세요." rows={6}
            className="w-full bg-card border border-border px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y" />
          <div className="flex justify-end mt-3">
            <button onClick={handleGenerate} disabled={isGenerating || !passage.trim()}
              className="px-6 py-2 bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
              {isGenerating ? "생성 중..." : "Generate"}
            </button>
          </div>
        </div>

        {/* ═══ Vocabulary ═══ */}
        {vocabStatus !== "idle" && (
          <section className="border-t border-border pt-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              Vocabulary {vocabStatus === "loading" && <LoadingDot />}
            </h2>
            {vocabStatus === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
            {vocab.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {[vocab.slice(0, 10), vocab.slice(10, 20)].map((col, colIdx) => (
                  <div key={colIdx} className="border border-border divide-y divide-border">
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span className="w-5 text-center">#</span>
                      <span className="min-w-[80px]">Word</span>
                      <span className="w-10 text-center">POS</span>
                      <span className="flex-1">Meaning</span>
                    </div>
                    {col.map((v, i) => {
                      const num = colIdx * 10 + i + 1;
                      return (
                        <div key={num} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                          <span className="w-5 text-center text-muted-foreground text-[10px]">{num}</span>
                          <span className="font-english font-semibold min-w-[80px]">{v.word}</span>
                          <span className="text-muted-foreground w-10 text-center text-[10px]">{v.pos}</span>
                          <span className="flex-1">{v.meaning_ko}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ Key Summary ═══ */}
        {previewStatus !== "idle" && (
          <section className="border-t border-border pt-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              Key Summary {previewStatus === "loading" && <LoadingDot />}
            </h2>
            {previewStatus === "error" && <p className="text-xs text-destructive">요약 생성에 실패했습니다.</p>}
            {summary && (
              <div className="border-l-2 border-muted-foreground/30 pl-4">
                {summary.split("\n").map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed">{line}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ Structure ═══ */}
        {structureStatus !== "idle" && (
          <section className="border-t border-border pt-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              Structure {structureStatus === "loading" && <LoadingDot />}
            </h2>
            {structureStatus === "error" && <p className="text-xs text-destructive">구조 흐름 생성에 실패했습니다.</p>}
            {structure.length > 0 && (
              <div className="space-y-2">
                {structure.map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="text-sm font-bold font-english w-5 shrink-0 text-right text-muted-foreground">{s.step}.</span>
                    <p className="text-sm leading-relaxed">{s.one_line}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ Topic / Title / Summary ═══ */}
        {previewStatus !== "idle" && examBlock && (
          <section className="border-t border-border pt-5 space-y-5">
            <div>
              <p className={subLabel}>Topic</p>
              <p className={enText}>{examBlock.topic}</p>
              {examBlock.topic_ko && <p className={koText}>{examBlock.topic_ko}</p>}
            </div>
            <div>
              <p className={subLabel}>Title</p>
              <p className={`${enText} font-semibold`}>{examBlock.title}</p>
              {examBlock.title_ko && <p className={koText}>{examBlock.title_ko}</p>}
            </div>
            <div>
              <p className={subLabel}>Summary</p>
              <p className={enText}>{examBlock.one_sentence_summary}</p>
              {examBlock.one_sentence_summary_ko && <p className={koText}>{examBlock.one_sentence_summary_ko}</p>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
