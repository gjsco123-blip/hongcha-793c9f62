import { useState, useMemo, useCallback, useEffect, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft, Loader2, RefreshCw, Plus, Pencil, Trash2, Check, X, ChevronDown, FileDown,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PassageBuilderPdf } from "@/components/PassageBuilderPdf";

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

type SectionStatus = "idle" | "loading" | "done" | "error";

const POS_OPTIONS = ["동", "명", "형", "부", "접", "전"];

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

export default function PassageBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [passage, setPassage] = useState((location.state as any)?.passage || "");

  // ── Vocabulary ──
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [vocabStatus, setVocabStatus] = useState<SectionStatus>("idle");
  const [candidates, setCandidates] = useState<VocabItem[]>([]);
  const [editingVocab, setEditingVocab] = useState<{ index: number; item: VocabItem } | null>(null);
  const [addVocabOpen, setAddVocabOpen] = useState(false);
  const [newVocab, setNewVocab] = useState<VocabItem>({ word: "", pos: "명", meaning_ko: "", in_context: "" });
  const [regenVocabOpen, setRegenVocabOpen] = useState(false);

  // ── Structure ──
  const [structure, setStructure] = useState<StructureStep[]>([]);
  const [structureStatus, setStructureStatus] = useState<SectionStatus>("idle");
  const [editingStep, setEditingStep] = useState<{ index: number; item: StructureStep } | null>(null);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [newStep, setNewStep] = useState<Omit<StructureStep, "step">>({ one_line: "", evidence: "" });
  const [showAdvancedStructure, setShowAdvancedStructure] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());

  // ── Explanation ──
  const [explanation, setExplanation] = useState("");
  const [explanationStatus, setExplanationStatus] = useState<SectionStatus>("idle");

  // ── Generate All ──
  const isGenerating = vocabStatus === "loading" || structureStatus === "loading" || explanationStatus === "loading";

  const handleGenerate = async () => {
    if (!passage.trim() || isGenerating) return;

    setVocabStatus("loading");
    setStructureStatus("loading");
    setExplanationStatus("loading");
    setCandidates([]);

    const vocabPromise = invokeRetry("analyze-vocab", { passage, count: 20 })
      .then((d) => { setVocab(d.vocab || []); setVocabStatus("done"); })
      .catch((e) => { toast.error(`어휘 생성 실패: ${e.message}`); setVocabStatus("error"); });

    const structPromise = invokeRetry("analyze-structure", { passage })
      .then((d) => { setStructure(d.structure_steps || []); setStructureStatus("done"); })
      .catch((e) => { toast.error(`구조요약 생성 실패: ${e.message}`); setStructureStatus("error"); });

    const explPromise = invokeRetry("analyze-explanation", { passage })
      .then((d) => { setExplanation(d.easy_explanation || ""); setExplanationStatus("done"); })
      .catch((e) => { toast.error(`쉬운 해설 생성 실패: ${e.message}`); setExplanationStatus("error"); });

    await Promise.allSettled([vocabPromise, structPromise, explPromise]);
  };

  // ── Vocab actions ──
  const handleRegenVocab = async (mode: "replace" | "candidates") => {
    setRegenVocabOpen(false);
    setVocabStatus("loading");
    try {
      const exclude = mode === "candidates" ? vocab.map((v) => v.word) : [];
      const count = mode === "candidates" ? 10 : 20;
      const data = await invokeRetry("analyze-vocab", { passage, count, exclude_words: exclude });
      if (mode === "replace") {
        setVocab(data.vocab || []);
      } else {
        setCandidates(data.vocab || []);
      }
      setVocabStatus("done");
    } catch (e: any) {
      toast.error(`어휘 재생성 실패: ${e.message}`);
      setVocabStatus("error");
    }
  };

  const handleAddCandidate = (item: VocabItem) => {
    if (vocab.length >= 20) {
      toast.warning("어휘가 20개를 초과했습니다. 삭제 후 추가하세요.");
      return;
    }
    setVocab((prev) => [...prev, item]);
    setCandidates((prev) => prev.filter((c) => c.word !== item.word));
  };

  const handleSaveNewVocab = () => {
    if (!newVocab.word.trim()) return;
    setVocab((prev) => [...prev, newVocab]);
    setNewVocab({ word: "", pos: "명", meaning_ko: "", in_context: "" });
    setAddVocabOpen(false);
  };

  const handleSaveEditVocab = () => {
    if (!editingVocab) return;
    setVocab((prev) => prev.map((v, i) => (i === editingVocab.index ? editingVocab.item : v)));
    setEditingVocab(null);
  };

  // ── Structure actions ──
  const handleRegenStructure = async (mode: "all" | "selected") => {
    setStructureStatus("loading");
    try {
      const body: any = { passage };
      if (mode === "selected") body.regen_steps = Array.from(selectedSteps);
      const data = await invokeRetry("analyze-structure", body);
      if (mode === "all") {
        setStructure(data.structure_steps || []);
      } else {
        const newSteps = data.structure_steps || [];
        setStructure((prev) =>
          prev.map((s) => {
            const replacement = newSteps.find((n: StructureStep) => n.step === s.step);
            return replacement || s;
          })
        );
      }
      setStructureStatus("done");
      setSelectedSteps(new Set());
    } catch (e: any) {
      toast.error(`구조요약 재생성 실패: ${e.message}`);
      setStructureStatus("error");
    }
  };

  const handleDeleteStep = (index: number) => {
    setStructure((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, step: i + 1 }));
    });
  };

  const handleSaveNewStep = () => {
    if (!newStep.one_line.trim()) return;
    setStructure((prev) => [...prev, { ...newStep, step: prev.length + 1 }]);
    setNewStep({ one_line: "", evidence: "" });
    setAddStepOpen(false);
  };

  const handleSaveEditStep = () => {
    if (!editingStep) return;
    setStructure((prev) => prev.map((s, i) => (i === editingStep.index ? editingStep.item : s)));
    setEditingStep(null);
  };

  // ── Explanation actions ──
  const handleRegenExplanation = async () => {
    setExplanationStatus("loading");
    try {
      const data = await invokeRetry("analyze-explanation", { passage });
      setExplanation(data.easy_explanation || "");
      setExplanationStatus("done");
    } catch (e: any) {
      toast.error(`쉬운 해설 재생성 실패: ${e.message}`);
      setExplanationStatus("error");
    }
  };

  // ── PDF Export ──
  const canExport = vocab.length > 0 || structure.length > 0 || explanation;
  const handleExportPdf = async () => {
    const doc = createElement(PassageBuilderPdf, { vocab, structure, explanation }) as any;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "passage-builder.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("PDF가 저장되었습니다.");
  };

  // ── Section loading indicator ──
  const Spinner = () => <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-foreground">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-wide flex-1">Passage Builder</h1>
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

        {/* ═══ A) Vocabulary ═══ */}
        {(vocabStatus !== "idle") && (
          <section className="border-t-2 border-foreground pt-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                Vocabulary ({vocab.length})
                {vocabStatus === "loading" && <Spinner />}
              </h2>
              {vocabStatus === "done" && (
                <div className="flex gap-2">
                  <button onClick={() => setRegenVocabOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                  <button onClick={() => setAddVocabOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              )}
            </div>

            {vocabStatus === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}

            {vocab.length > 0 && (
              <div className="border border-border divide-y divide-border">
                {vocab.map((v, i) => (
                  <div key={`${v.word}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-xs group">
                    <span className="w-5 text-muted-foreground">{i + 1}</span>
                    <span className="font-english font-semibold min-w-[100px]">{v.word}</span>
                    <span className="text-muted-foreground w-8 text-center">{v.pos}</span>
                    <span className="flex-1">{v.meaning_ko}</span>
                    <span className="text-muted-foreground font-english text-[11px] italic max-w-[200px] truncate">{v.in_context}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingVocab({ index: i, item: { ...v } })} className="p-1 hover:text-foreground text-muted-foreground"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => setVocab((p) => p.filter((_, j) => j !== i))} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {vocab.length < 20 && vocab.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">⚠️ 어휘가 20개 미만입니다. ({vocab.length}/20)</p>
            )}

            {/* Candidates */}
            {candidates.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">후보 어휘</h3>
                <div className="border border-dashed border-border divide-y divide-border">
                  {candidates.map((c, i) => (
                    <div key={`cand-${c.word}-${i}`} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="font-english font-semibold min-w-[100px]">{c.word}</span>
                      <span className="text-muted-foreground w-8 text-center">{c.pos}</span>
                      <span className="flex-1">{c.meaning_ko}</span>
                      <button onClick={() => handleAddCandidate(c)} className="px-2 py-0.5 border border-foreground text-[10px] hover:bg-foreground hover:text-background transition-colors">
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ B) Structure Summary ═══ */}
        {(structureStatus !== "idle") && (
          <section className="border-t-2 border-foreground pt-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                Structure Summary ({structure.length})
                {structureStatus === "loading" && <Spinner />}
              </h2>
              {structureStatus === "done" && (
                <div className="flex gap-2">
                  <button onClick={() => handleRegenStructure("all")} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                  <button onClick={() => setAddStepOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                  <button onClick={() => setShowAdvancedStructure(!showAdvancedStructure)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedStructure ? "rotate-180" : ""}`} /> 고급
                  </button>
                </div>
              )}
            </div>

            {structureStatus === "error" && <p className="text-xs text-destructive">구조요약 생성에 실패했습니다.</p>}

            {showAdvancedStructure && structure.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">선택 후 재생성:</span>
                <button
                  onClick={() => handleRegenStructure("selected")}
                  disabled={selectedSteps.size === 0 || structureStatus === "loading"}
                  className="px-3 py-1 border border-border text-[11px] hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Regenerate Selected ({selectedSteps.size})
                </button>
              </div>
            )}

            {structure.length > 0 && (
              <div className="border border-border divide-y divide-border">
                {structure.map((s, i) => (
                  <div key={`step-${s.step}-${i}`} className="flex items-start gap-3 px-4 py-3 text-xs group">
                    {showAdvancedStructure && (
                      <input
                        type="checkbox"
                        checked={selectedSteps.has(s.step)}
                        onChange={(e) => {
                          const next = new Set(selectedSteps);
                          e.target.checked ? next.add(s.step) : next.delete(s.step);
                          setSelectedSteps(next);
                        }}
                        className="mt-0.5"
                      />
                    )}
                    <span className="font-semibold w-5 shrink-0">{s.step}</span>
                    <div className="flex-1 min-w-0">
                      <p>{s.one_line}</p>
                      <p className="text-muted-foreground font-english italic mt-0.5 text-[11px]">"{s.evidence}"</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => setEditingStep({ index: i, item: { ...s } })} className="p-1 hover:text-foreground text-muted-foreground"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => handleDeleteStep(i)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ C) Easy Explanation ═══ */}
        {(explanationStatus !== "idle") && (
          <section className="border-t-2 border-foreground pt-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                Easy Explanation
                {explanationStatus === "loading" && <Spinner />}
              </h2>
              {explanationStatus === "done" && (
                <button onClick={handleRegenExplanation} className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs hover:bg-muted transition-colors">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              )}
            </div>
            {explanationStatus === "error" && <p className="text-xs text-destructive">쉬운 해설 생성에 실패했습니다.</p>}
            {explanation && (
              <div className="bg-muted/50 border border-border p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{explanation}</p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ═══ Dialogs ═══ */}

      {/* Regenerate Vocab modal */}
      <Dialog open={regenVocabOpen} onOpenChange={setRegenVocabOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Regenerate Vocabulary</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <button onClick={() => handleRegenVocab("replace")} className="w-full text-left px-4 py-3 border border-border hover:bg-muted transition-colors text-sm">
              <strong>Replace All</strong>
              <p className="text-xs text-muted-foreground mt-0.5">기존 20개 완전 교체</p>
            </button>
            <button onClick={() => handleRegenVocab("candidates")} className="w-full text-left px-4 py-3 border border-border hover:bg-muted transition-colors text-sm">
              <strong>Add Candidates</strong>
              <p className="text-xs text-muted-foreground mt-0.5">새 후보 10개 생성 → 선택적 추가</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vocab modal */}
      <Dialog open={addVocabOpen} onOpenChange={setAddVocabOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Vocabulary</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <input value={newVocab.word} onChange={(e) => setNewVocab({ ...newVocab, word: e.target.value })} placeholder="word" className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
            <select value={newVocab.pos} onChange={(e) => setNewVocab({ ...newVocab, pos: e.target.value })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none">
              {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={newVocab.meaning_ko} onChange={(e) => setNewVocab({ ...newVocab, meaning_ko: e.target.value })} placeholder="meaning_ko" className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
            <input value={newVocab.in_context} onChange={(e) => setNewVocab({ ...newVocab, in_context: e.target.value })} placeholder="in_context" className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVocabOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNewVocab}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vocab modal */}
      <Dialog open={!!editingVocab} onOpenChange={() => setEditingVocab(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Vocabulary</DialogTitle></DialogHeader>
          {editingVocab && (
            <div className="space-y-3 py-2">
              <input value={editingVocab.item.word} onChange={(e) => setEditingVocab({ ...editingVocab, item: { ...editingVocab.item, word: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
              <select value={editingVocab.item.pos} onChange={(e) => setEditingVocab({ ...editingVocab, item: { ...editingVocab.item, pos: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none">
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={editingVocab.item.meaning_ko} onChange={(e) => setEditingVocab({ ...editingVocab, item: { ...editingVocab.item, meaning_ko: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
              <input value={editingVocab.item.in_context} onChange={(e) => setEditingVocab({ ...editingVocab, item: { ...editingVocab.item, in_context: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVocab(null)}>Cancel</Button>
            <Button onClick={handleSaveEditVocab}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Step modal */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Step</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <input value={newStep.one_line} onChange={(e) => setNewStep({ ...newStep, one_line: e.target.value })} placeholder="한 줄 요약" className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
            <input value={newStep.evidence} onChange={(e) => setNewStep({ ...newStep, evidence: e.target.value })} placeholder="evidence (원문 인용)" className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStepOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNewStep}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Step modal */}
      <Dialog open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Step</DialogTitle></DialogHeader>
          {editingStep && (
            <div className="space-y-3 py-2">
              <input value={editingStep.item.one_line} onChange={(e) => setEditingStep({ ...editingStep, item: { ...editingStep.item, one_line: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
              <input value={editingStep.item.evidence} onChange={(e) => setEditingStep({ ...editingStep, item: { ...editingStep.item, evidence: e.target.value } })} className="w-full border border-border px-3 py-2 text-sm bg-background outline-none focus:border-foreground" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>Cancel</Button>
            <Button onClick={handleSaveEditStep}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
