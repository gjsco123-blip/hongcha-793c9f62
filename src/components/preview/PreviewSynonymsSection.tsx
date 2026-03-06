import { useState } from "react";
import { CompareOverlay } from "./CompareOverlay";
import type { SynAntItem, SectionStatus } from "./types";

interface Props {
  synonyms: SynAntItem[];
  status: SectionStatus;
  onSynonymsChange: (v: SynAntItem[]) => void;
  onRegenerate: () => Promise<SynAntItem[]>;
}

export function PreviewSynonymsSection({ synonyms, status, onSynonymsChange, onRegenerate }: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<SynAntItem[] | null>(null);

  if (status === "idle") return null;

  const handleRegen = async () => {
    setIsRegen(true);
    try {
      const result = await onRegenerate();
      setCandidate(result);
    } finally {
      setIsRegen(false);
    }
  };

  const handleEdit = (idx: number, field: keyof SynAntItem, value: string) => {
    const updated = synonyms.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onSynonymsChange(updated);
  };

  const renderTable = (items: SynAntItem[]) => (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted/30 border-b-2 border-foreground/80">
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[30%] border-r border-border">Word</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Synonym</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Antonym</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-t border-border/50">
              <td className="px-3 py-2 text-muted-foreground font-medium border-r border-border">{item.word}</td>
              <td className="px-3 py-2 font-medium">{item.synonym}</td>
              <td className="px-3 py-2 font-medium">{item.antonym}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="border-t border-border pt-5">
      {status === "error" && <p className="text-xs text-destructive">동/반의어 생성에 실패했습니다.</p>}
      {synonyms.length > 0 && (
    <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/30 border-b-2 border-foreground/80">
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[30%] border-r border-border">Word</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Synonym</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Antonym</th>
              </tr>
            </thead>
            <tbody>
              {synonyms.map((item, idx) => (
                <tr key={idx} className="border-t border-border/50">
                  <td className="px-3 py-2 text-foreground font-normal border-r border-border">{item.word}</td>
                  <td className="px-3 py-2">
                    <input
                      value={item.synonym}
                      onChange={(e) => handleEdit(idx, "synonym", e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-[12px] font-semibold focus:bg-muted/20 rounded px-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.antonym}
                      onChange={(e) => handleEdit(idx, "antonym", e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-[12px] font-semibold focus:bg-muted/20 rounded px-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {candidate && (
        <CompareOverlay
          title="Synonyms & Antonyms"
          oldContent={renderTable(synonyms)}
          newContent={renderTable(candidate)}
          onAccept={() => { onSynonymsChange(candidate); setCandidate(null); }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
