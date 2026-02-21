import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import type { StructureStep, SectionStatus } from "./types";

interface Props {
  structure: StructureStep[];
  status: SectionStatus;
  onStructureChange: (v: StructureStep[]) => void;
  onRegenerate: () => Promise<StructureStep[]>;
}

export function PreviewStructureSection({ structure, status, onStructureChange, onRegenerate }: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<StructureStep[] | null>(null);

  if (status === "idle") return null;

  const handleRegen = async () => {
    setIsRegen(true);
    try {
      const newStruct = await onRegenerate();
      setCandidate(newStruct);
    } finally {
      setIsRegen(false);
    }
  };

  const handleEdit = (idx: number, value: string) => {
    const updated = structure.map((s, i) => i === idx ? { ...s, one_line: value } : s);
    onStructureChange(updated);
  };

  const renderSteps = (steps: StructureStep[]) => (
    <div className="border-l-[2px] border-muted-foreground/25 pl-5 py-1">
      {steps.map((st, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <p className="text-[13px] leading-[1.7] text-center">{st.one_line}</p>
          {idx < steps.length - 1 && <span className="text-muted-foreground/30 text-[10px] my-1.5">↓</span>}
        </div>
      ))}
    </div>
  );

  return (
    <section className="border-t border-border pt-5">
      <SectionHeader title="Structure" status={status} onRegenerate={handleRegen} isRegenerating={isRegen} />
      {status === "error" && <p className="text-xs text-destructive">구조 흐름 생성에 실패했습니다.</p>}
      {structure.length > 0 && (
        <div className="border-l-[2px] border-muted-foreground/25 pl-5 py-1">
          {structure.map((st, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <input
                value={st.one_line}
                onChange={(e) => handleEdit(idx, e.target.value)}
                className="w-full text-[13px] leading-[1.7] text-center bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1"
              />
              {idx < structure.length - 1 && <span className="text-muted-foreground/30 text-[10px] my-1.5">↓</span>}
            </div>
          ))}
        </div>
      )}
      {candidate && (
        <CompareOverlay
          title="Structure"
          oldContent={renderSteps(structure)}
          newContent={renderSteps(candidate)}
          onAccept={() => { onStructureChange(candidate); setCandidate(null); }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
