import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import type { SectionStatus } from "./types";

interface Props {
  summary: string;
  status: SectionStatus;
  onSummaryChange: (v: string) => void;
  onRegenerate: () => Promise<string>;
}

export function PreviewSummarySection({ summary, status, onSummaryChange, onRegenerate }: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);

  if (status === "idle") return null;

  const lines = summary.split("\n").filter(Boolean);

  const handleRegen = async () => {
    setIsRegen(true);
    try {
      const newSummary = await onRegenerate();
      setCandidate(newSummary);
    } finally {
      setIsRegen(false);
    }
  };

  const handleLineEdit = (idx: number, value: string) => {
    const newLines = [...lines];
    newLines[idx] = value;
    onSummaryChange(newLines.join("\n"));
  };

  return (
    <section className="border-t border-border pt-5">
      <SectionHeader title="Key Summary" status={status} onRegenerate={handleRegen} isRegenerating={isRegen} />
      {status === "error" && <p className="text-xs text-destructive">요약 생성에 실패했습니다.</p>}
      {summary && (
        <div className="border-l-[2px] border-muted-foreground/25 pl-5 py-1 space-y-1">
          {lines.map((line, i) => (
            <input
              key={i}
              value={line}
              onChange={(e) => handleLineEdit(i, e.target.value)}
              className="w-full text-[13px] leading-[1.7] bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
            />
          ))}
        </div>
      )}
      {candidate && (
        <CompareOverlay
          title="Key Summary"
          oldContent={lines.map((l, i) => <p key={i} className="leading-[1.7]">{l}</p>)}
          newContent={candidate.split("\n").filter(Boolean).map((l, i) => <p key={i} className="leading-[1.7]">{l}</p>)}
          onAccept={() => { onSummaryChange(candidate); setCandidate(null); }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
