import { useState } from "react";
import { CompareOverlay } from "./CompareOverlay";
import { Plus, Loader2, X, MousePointerClick, Check } from "lucide-react";
import type { SynAntItem, SectionStatus, VocabItem } from "./types";

interface Props {
  synonyms: SynAntItem[];
  vocab: VocabItem[];
  status: SectionStatus;
  onSynonymsChange: (v: SynAntItem[]) => void;
  onRegenerate: () => Promise<SynAntItem[]>;
  onEnrichRow: (idx: number) => Promise<void>;
  enrichingIdx: number | null;
  onDeleteRow: (idx: number) => void;
  onRequestAddFromPassage: () => void;
  synonymSelectMode?: boolean;
}

function splitChips(str: string): string[] {
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinChips(chips: string[]): string {
  return chips.join(", ");
}

function ChipList({ chips, onDelete }: { chips: string[]; onDelete: (chipIdx: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip, i) => (
        <span key={i} className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-foreground">
          {chip}
          <button onClick={() => onDelete(i)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-destructive" title="삭제">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function PreviewSynonymsSection({
  synonyms, vocab, status, onSynonymsChange, onRegenerate, onEnrichRow, enrichingIdx,
  onDeleteRow, onRequestAddFromPassage, synonymSelectMode,
}: Props) {
  const [isRegen, setIsRegen] = useState(false);
  const [candidate, setCandidate] = useState<SynAntItem[] | null>(null);
  const [addingManual, setAddingManual] = useState(false);
  const [manualWord, setManualWord] = useState("");
  const [manualSynonym, setManualSynonym] = useState("");
  const [editingCell, setEditingCell] = useState<{ row: number; field: "word" | "synonym" | "antonym" } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [manualAntonym, setManualAntonym] = useState("");

  if (status === "idle") return null;

  const resetManual = () => {
    setAddingManual(false);
    setManualWord("");
    setManualSynonym("");
    setManualAntonym("");
  };

  const normalizeWord = (text: string) =>
    text
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .replace(/[^a-z0-9'\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const withAutoMeaning = (word: string) => {
    if (/\([^)]*\)\s*$/.test(word)) return word;
    const key = normalizeWord(word);
    if (!key) return word;
    const found = vocab.find((v) => normalizeWord(v.word) === key && v.meaning_ko?.trim());
    return found ? `${word} (${found.meaning_ko.trim()})` : word;
  };

  const addManualRow = () => {
    const word = manualWord.trim();
    if (!word) return;
    onSynonymsChange([
      ...synonyms,
      { word: withAutoMeaning(word), synonym: manualSynonym.trim(), antonym: manualAntonym.trim() },
    ]);
    resetManual();
  };

  const handleDeleteChip = (rowIdx: number, field: "synonym" | "antonym", chipIdx: number) => {
    const chips = splitChips(synonyms[rowIdx][field]);
    const updated = chips.filter((_, i) => i !== chipIdx);
    const newSynonyms = synonyms.map((s, i) => (i === rowIdx ? { ...s, [field]: joinChips(updated) } : s));
    onSynonymsChange(newSynonyms);
  };

  const canEnrich = (item: SynAntItem) => {
    return splitChips(item.synonym).length < 4 || splitChips(item.antonym).length < 4;
  };

  const renderTable = (items: SynAntItem[], showActions = true) => (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted/30 border-b-2 border-foreground/80">
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[25%] border-r border-border">Word</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Synonym</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[35%]">Antonym</th>
            {showActions && <th className="w-[5%]"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-t border-border/50 group">
              <td className="px-3 py-2 text-foreground font-normal border-r border-border">
                <div className="flex items-center justify-between">
                  <span>{item.word}</span>
                  {showActions && (
                    <button
                      onClick={() => onDeleteRow(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                      title="행 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <ChipList chips={splitChips(item.synonym)} onDelete={(chipIdx) => handleDeleteChip(idx, "synonym", chipIdx)} />
              </td>
              <td className="px-3 py-2">
                <ChipList chips={splitChips(item.antonym)} onDelete={(chipIdx) => handleDeleteChip(idx, "antonym", chipIdx)} />
              </td>
              {showActions && (
                <td className="px-2 py-2 text-center">
                  {enrichingIdx === idx ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mx-auto" />
                  ) : canEnrich(item) ? (
                    <button onClick={() => onEnrichRow(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" title="AI로 동/반의어 추가">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="border-t border-border pt-5">
      {status === "error" && <p className="text-xs text-destructive">동/반의어 생성에 실패했습니다.</p>}

      <div className="space-y-2">
        <div className="flex justify-end gap-1.5">
          <button
            onClick={() => setAddingManual((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              addingManual
                ? "border-foreground bg-foreground text-background"
                : "border-foreground text-foreground hover:bg-foreground hover:text-background"
            }`}
          >
            <Plus className="w-3 h-3" />
            {addingManual ? "입력 중..." : "직접 추가"}
          </button>
          
          <button
            onClick={onRequestAddFromPassage}
            className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              synonymSelectMode
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <MousePointerClick className="w-3 h-3" />
            {synonymSelectMode ? "선택 중..." : "지문에서 추가"}
          </button>
        </div>

        {addingManual && (
          <div className="border border-border rounded-xl p-2 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-center">
            <input
              value={manualWord}
              onChange={(e) => setManualWord(e.target.value)}
              placeholder="WORD 입력 (예: influence (영향))"
              className="h-8 px-2 text-xs border border-border rounded bg-background outline-none focus:border-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") addManualRow();
                if (e.key === "Escape") resetManual();
              }}
            />
            <input
              value={manualSynonym}
              onChange={(e) => setManualSynonym(e.target.value)}
              placeholder="SYNONYM (쉼표로 구분)"
              className="h-8 px-2 text-xs border border-border rounded bg-background outline-none focus:border-foreground"
            />
            <input
              value={manualAntonym}
              onChange={(e) => setManualAntonym(e.target.value)}
              placeholder="ANTONYM (쉼표로 구분)"
              className="h-8 px-2 text-xs border border-border rounded bg-background outline-none focus:border-foreground"
            />
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={addManualRow}
                disabled={!manualWord.trim()}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                title="행 추가"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetManual}
                className="p-1.5 text-muted-foreground hover:text-destructive"
                title="취소"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {synonyms.length > 0 && renderTable(synonyms)}
      </div>

      {candidate && (
        <CompareOverlay
          title="Synonyms & Antonyms"
          oldContent={renderTable(synonyms, false)}
          newContent={renderTable(candidate, false)}
          onAccept={() => { onSynonymsChange(candidate); setCandidate(null); }}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
