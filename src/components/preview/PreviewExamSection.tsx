import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import type { ExamBlock, SectionStatus } from "./types";

interface Props {
  examBlock: ExamBlock | null;
  status: SectionStatus;
  onExamChange: (v: ExamBlock) => void;
  onRegenerate: () => Promise<ExamBlock>;
}

function ExamField({ label, value, valueSub, onChange, onSubChange }: {
  label: string;
  value: string;
  valueSub?: string;
  onChange: (v: string) => void;
  onSubChange?: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
      />
      {valueSub !== undefined && (
        <input
          value={valueSub || ""}
          onChange={(e) => onSubChange?.(e.target.value)}
          className="w-full text-xs text-muted-foreground/60 mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
        />
      )}
    </div>
  );
}

export function PreviewExamSection({ examBlock, status, onExamChange, onRegenerate }: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<ExamBlock | null>(null);

  if (status === "idle" || !examBlock) return null;

  const handleRegen = async () => {
    setIsRegen(true);
    try {
      const newExam = await onRegenerate();
      setCandidate(newExam);
    } finally {
      setIsRegen(false);
    }
  };

  const update = (patch: Partial<ExamBlock>) => onExamChange({ ...examBlock, ...patch });

  const renderExam = (eb: ExamBlock) => (
    <div className="space-y-3">
      <div>
        <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Topic</p>
        <p className="text-xs">{eb.topic}</p>
        {eb.topic_ko && <p className="text-[10px] text-muted-foreground/60">{eb.topic_ko}</p>}
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Title</p>
        <p className="text-xs">{eb.title}</p>
        {eb.title_ko && <p className="text-[10px] text-muted-foreground/60">{eb.title_ko}</p>}
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Summary</p>
        <p className="text-xs">{eb.one_sentence_summary}</p>
        {eb.one_sentence_summary_ko && <p className="text-[10px] text-muted-foreground/60">{eb.one_sentence_summary_ko}</p>}
      </div>
    </div>
  );

  return (
    <section className="border-t border-border pt-5">
      <SectionHeader title="Topic / Title / Summary" status={status} onRegenerate={handleRegen} isRegenerating={isRegen} />
      <div className="space-y-5">
        <ExamField label="Topic" value={examBlock.topic} valueSub={examBlock.topic_ko}
          onChange={(v) => update({ topic: v })} onSubChange={(v) => update({ topic_ko: v })} />
        <ExamField label="Title" value={examBlock.title} valueSub={examBlock.title_ko}
          onChange={(v) => update({ title: v })} onSubChange={(v) => update({ title_ko: v })} />
        <ExamField label="Summary" value={examBlock.one_sentence_summary} valueSub={examBlock.one_sentence_summary_ko}
          onChange={(v) => update({ one_sentence_summary: v })} onSubChange={(v) => update({ one_sentence_summary_ko: v })} />
      </div>
      {candidate && (
        <CompareOverlay
          title="Topic / Title / Summary"
          oldContent={renderExam(examBlock)}
          newContent={renderExam(candidate)}
          onAccept={() => { onExamChange(candidate); setCandidate(null); }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
