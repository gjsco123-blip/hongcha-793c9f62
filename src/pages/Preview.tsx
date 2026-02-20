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
  title: string;
  one_sentence_summary: string;
}

type SectionStatus = "idle" | "loading" | "done" | "error";

// ── Retry helper ──
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

  // ── Section states ──
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
      .then((d) => {
        setSummary(d.summary || "");
        setExamBlock(d.exam_block || null);
        setPreviewStatus("done");
      })
      .catch((e) => { toast.error(`요약/시험형 생성 실패: ${e.message}`); setPreviewStatus("error"); });

    await Promise.allSettled([vocabPromise, structPromise, previewPromise]);
  };

  const handleExportPdf = async () => {
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
  };

  const canExport = vocab.length > 0 || structure.length > 0 || summary;
  const Spinner = () => <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-foreground">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Eye className="w-5 h-5" />
            <h1 className="text-xl font-bold tracking-wide">Preview</h1>
          </div>
          {canExport && (
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF 저장
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        {/* Input */}
        <div>
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            placeholder="영어 지문 전체를 붙여넣으세요."
            rows={6}
            className="w-full bg-card border border-border px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !passage.trim()}
              className="px-6 py-2 bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isGenerating ? "생성 중..." : "Generate"}
            </button>
          </div>
        </div>

        {/* ═══ ① 핵심 어휘 20 ═══ */}
        {vocabStatus !== "idle" && (
          <section className="border-t-2 border-foreground pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold">1</span>
              핵심 어휘 ({vocab.length})
              {vocabStatus === "loading" && <Spinner />}
            </h2>
            {vocabStatus === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
            {vocab.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {[vocab.slice(0, 10), vocab.slice(10, 20)].map((col, colIdx) => (
                  <div key={colIdx} className="border border-border divide-y divide-border">
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span className="w-5 text-center">#</span>
                      <span className="min-w-[80px]">Word</span>
                      <span className="w-8 text-center">품사</span>
                      <span className="flex-1">뜻</span>
                    </div>
                    {col.map((v, i) => {
                      const num = colIdx * 10 + i + 1;
                      return (
                        <div key={num} className={`flex items-center gap-3 px-3 py-2 text-xs ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                          <span className="w-5 text-center text-muted-foreground text-[10px]">{num}</span>
                          <span className="font-english font-semibold min-w-[80px]">{v.word}</span>
                          <span className="text-muted-foreground w-8 text-center">{v.pos}</span>
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

        {/* ═══ ② 구조 흐름 5단계 ═══ */}
        {structureStatus !== "idle" && (
          <section className="border-t-2 border-foreground pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold">2</span>
              구조 흐름 ({structure.length})
              {structureStatus === "loading" && <Spinner />}
            </h2>
            {structureStatus === "error" && <p className="text-xs text-destructive">구조 흐름 생성에 실패했습니다.</p>}
            {structure.length > 0 && (
              <div className="space-y-3">
                {structure.map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="text-sm font-bold font-english w-5 shrink-0 text-right">{s.step}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{s.one_line}</p>
                      <p className="text-xs text-muted-foreground font-english italic mt-0.5">"{s.evidence}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ ③ 핵심 요약 ═══ */}
        {previewStatus !== "idle" && (
          <section className="border-t-2 border-foreground pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold">3</span>
              핵심 요약
              {previewStatus === "loading" && <Spinner />}
            </h2>
            {previewStatus === "error" && <p className="text-xs text-destructive">요약 생성에 실패했습니다.</p>}
            {summary && (
              <div className="bg-muted/40 border-l-[3px] border-foreground px-5 py-4">
                <p className="text-sm leading-relaxed">{summary}</p>
              </div>
            )}
          </section>
        )}

        {/* ═══ ④ 시험형 블록 ═══ */}
        {previewStatus !== "idle" && examBlock && (
          <section className="border-t-2 border-foreground pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-[10px] font-bold">4</span>
              시험형 블록
            </h2>
            <div className="border border-border divide-y divide-border">
              <div className="flex items-start gap-4 px-4 py-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 shrink-0 pt-0.5">Topic</span>
                <p className="text-sm flex-1">{examBlock.topic}</p>
              </div>
              <div className="flex items-start gap-4 px-4 py-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 shrink-0 pt-0.5">Title</span>
                <p className="text-sm font-english font-semibold flex-1">{examBlock.title}</p>
              </div>
              <div className="flex items-start gap-4 px-4 py-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 shrink-0 pt-0.5">Summary</span>
                <p className="text-sm font-english flex-1 leading-relaxed">{examBlock.one_sentence_summary}</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
