import { useState, createElement, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, FileDown, Eye } from "lucide-react";
import { PreviewPdf } from "@/components/PreviewPdf";
import { PreviewPassageInput } from "@/components/preview/PreviewPassageInput";
import { PreviewVocabSection } from "@/components/preview/PreviewVocabSection";
import { PreviewSummarySection } from "@/components/preview/PreviewSummarySection";
import { PreviewStructureSection } from "@/components/preview/PreviewStructureSection";
import { PreviewExamSection } from "@/components/preview/PreviewExamSection";
import type { VocabItem, StructureStep, ExamBlock, SectionStatus } from "@/components/preview/types";

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
  const [addingWord, setAddingWord] = useState<string | null>(null);

  const isGenerating = vocabStatus === "loading" || structureStatus === "loading" || previewStatus === "loading";

  const handleGenerate = async () => {
    if (!passage.trim() || isGenerating) return;
    setVocabStatus("loading");
    setStructureStatus("loading");
    setPreviewStatus("loading");

    const vocabPromise = invokeRetry("analyze-vocab", { passage, count: 30 })
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

  // ── Vocab: add word from passage click ──
  const handleWordClick = useCallback(async (word: string) => {
    const lower = word.toLowerCase();
    if (vocab.some((v) => v.word.toLowerCase() === lower)) {
      toast.info("이미 추가된 단어입니다.");
      return;
    }
    setAddingWord(lower);
    try {
      const data = await invokeRetry("analyze-single-vocab", { word, passage });
      if (data.vocab) {
        setVocab((prev) => [...prev, data.vocab]);
        toast.success(`"${word}" 추가됨`);
      }
    } catch (e: any) {
      toast.error(`단어 추가 실패: ${e.message}`);
    } finally {
      setAddingWord(null);
    }
  }, [vocab, passage]);

  const handleVocabDelete = useCallback((index: number) => {
    setVocab((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVocabEdit = useCallback((index: number, field: keyof VocabItem, value: string) => {
    setVocab((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }, []);

  // ── Regenerate handlers (return new data for compare) ──
  const regenSummary = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.summary || "";
  }, [passage]);

  const regenStructure = useCallback(async (): Promise<StructureStep[]> => {
    const data = await invokeRetry("analyze-structure", { passage, step_count: 5 });
    return (data.structure_steps || []).slice(0, 5);
  }, [passage]);

  const regenExamTopic = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.exam_block?.topic || "";
  }, [passage]);

  const regenExamTitle = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.exam_block?.title || "";
  }, [passage]);

  const regenExamSummary = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.exam_block?.one_sentence_summary || "";
  }, [passage]);

  // ── PDF export ──
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
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const canExport = vocab.length > 0 || structure.length > 0 || summary;

  return (
    <div className="min-h-screen bg-background">
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
        <PreviewPassageInput
          passage={passage}
          setPassage={setPassage}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          vocabReady={vocabStatus === "done"}
          onWordClick={handleWordClick}
          addingWord={addingWord}
        />

        <PreviewVocabSection
          vocab={vocab}
          status={vocabStatus}
          onDelete={handleVocabDelete}
          onEdit={handleVocabEdit}
        />

        <PreviewSummarySection
          summary={summary}
          status={previewStatus}
          onSummaryChange={setSummary}
          onRegenerate={regenSummary}
        />

        <PreviewStructureSection
          structure={structure}
          status={structureStatus}
          onStructureChange={setStructure}
          onRegenerate={regenStructure}
        />

        <PreviewExamSection
          examBlock={examBlock}
          status={previewStatus}
          onExamChange={setExamBlock}
          onRegenerateTopic={regenExamTopic}
          onRegenerateTitle={regenExamTitle}
          onRegenerateSummary={regenExamSummary}
        />
      </main>
    </div>
  );
}
