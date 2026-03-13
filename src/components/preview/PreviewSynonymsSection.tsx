import { useState } from "react";
import { CompareOverlay } from "./CompareOverlay";
import { Plus, Loader2, X } from "lucide-react";
import type { SynAntItem, SectionStatus } from "./types";

interface Props {
  synonyms: SynAntItem[];
  status: SectionStatus;
  onSynonymsChange: (v: SynAntItem[]) => void;
  onRegenerate: () => Promise<SynAntItem[]>;
  onEnrichRow: (idx: number) => Promise<void>;
  enrichingIdx: number | null;
}

function splitChips(str: string): string[] {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinChips(chips: string[]): string {
  return chips.join(", ");
}

function ChipList({ chips, onDelete }: { chips: string[]; onDelete: (chipIdx: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-foreground"
        >
          {chip}
          <button
            onClick={() => onDelete(i)}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-destructive"
            title="삭제"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function PreviewSynonymsSection({
  synonyms,
  status,
  onSynonymsChange,
  onRegenerate,
  onEnrichRow,
  enrichingIdx,
}: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<SynAntItem[] | null>(null);

  if (status === "idle") return null;

  const handleDeleteChip = (rowIdx: number, field: "synonym" | "antonym", chipIdx: number) => {
    const chips = splitChips(synonyms[rowIdx][field]);
    const updated = chips.filter((_, i) => i !== chipIdx);
    const newSynonyms = synonyms.map((s, i) => (i === rowIdx ? { ...s, [field]: joinChips(updated) } : s));
    onSynonymsChange(newSynonyms);
  };

  const canEnrich = (item: SynAntItem) => {
    return splitChips(item.synonym).length < 4 || splitChips(item.antonym).length < 4;
  };

  const renderTable = (items: SynAntItem[]) => (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted/30 border-b-2 border-foreground/80">
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[25%] border-r border-border">
              Word
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">
              Synonym
            </th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">
              Antonym
            </th>
            <th className="w-[5%]"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-t border-border/50 group">
              <td className="px-3 py-2 text-foreground font-normal border-r border-border">{item.word}</td>
              <td className="px-3 py-2">
                <ChipList
                  chips={splitChips(item.synonym)}
                  onDelete={(chipIdx) => handleDeleteChip(idx, "synonym", chipIdx)}
                />
              </td>
              <td className="px-3 py-2">
                <ChipList
                  chips={splitChips(item.antonym)}
                  onDelete={(chipIdx) => handleDeleteChip(idx, "antonym", chipIdx)}
                />
              </td>
              <td className="px-2 py-2 text-center">
                {enrichingIdx === idx ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mx-auto" />
                ) : canEnrich(item) ? (
                  <button
                    onClick={() => onEnrichRow(idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="AI로 동/반의어 추가"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="border-t border-border pt-5">
      {status === "error" && <p className="text-xs text-destructive">동/반의어 생성에 실패했습니다.</p>}
      {synonyms.length > 0 && renderTable(synonyms)}
      {candidate && (
        <CompareOverlay
          title="Synonyms & Antonyms"
          oldContent={renderTable(synonyms)}
          newContent={renderTable(candidate)}
          onAccept={() => {
            onSynonymsChange(candidate);
            setCandidate(null);
          }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
