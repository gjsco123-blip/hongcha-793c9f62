import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ClipboardPaste, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { VocabItem } from "./types";

const MAX_VOCAB = 40;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passage: string;
  existingWords: string[];
  currentCount: number;
  onAdd: (items: VocabItem[]) => void;
}

export function VocabPasteDialog({ open, onOpenChange, passage, existingWords, currentCount, onAdd }: Props) {
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<VocabItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const remaining = MAX_VOCAB - currentCount;

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setParsed(null);
    try {
      const { data, error } = await supabase.functions.invoke("parse-vocab-paste", {
        body: { raw_text: rawText, passage, existing_words: existingWords },
      });
      if (error) throw error;
      const items: VocabItem[] = data?.vocab || [];
      if (items.length === 0) {
        toast.info("파싱된 단어가 없습니다.");
      }
      setParsed(items);
    } catch (e: any) {
      toast.error(`파싱 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (idx: number) => {
    setParsed((prev) => prev ? prev.filter((_, i) => i !== idx) : null);
  };

  const handleAdd = () => {
    if (!parsed) return;
    const toAdd = parsed.slice(0, remaining);
    if (toAdd.length < parsed.length) {
      toast.warning(`최대 ${MAX_VOCAB}개까지만 가능합니다. ${toAdd.length}개만 추가됩니다.`);
    }
    onAdd(toAdd);
    setRawText("");
    setParsed(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setRawText("");
    setParsed(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ClipboardPaste className="w-4 h-4" /> 단어 붙여넣기
          </DialogTitle>
          <DialogDescription className="text-xs">
            외부에서 정리한 단어 목록을 붙여넣으면 AI가 기존 틀에 맞춰 정리합니다. (남은 슬롯: {remaining}개)
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"예시:\napply v 적용하다\nsignificant adj 중요한\n또는 자유 형식으로 붙여넣기"}
              className="min-h-[160px] text-xs font-mono"
            />
            <DialogFooter>
              <button
                onClick={handleParse}
                disabled={loading || !rawText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 rounded"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                정리하기
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="border border-border rounded divide-y divide-border/40 max-h-[300px] overflow-y-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                <span className="w-4">#</span>
                <span className="min-w-[60px]">Word</span>
                <span className="w-7 text-center">POS</span>
                <span className="flex-1">Meaning</span>
                <span className="w-5" />
              </div>
              {parsed.map((v, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="w-4 text-muted-foreground/50 text-[10px]">{i + 1}</span>
                  <span className="font-semibold min-w-[60px] truncate max-w-[80px]">{v.word}</span>
                  <span className="w-7 text-center text-[10px] text-muted-foreground/60">{v.pos}</span>
                  <span className="flex-1 truncate">{v.meaning_ko}</span>
                  <button onClick={() => handleRemoveItem(i)} className="w-5 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {parsed.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">파싱된 단어가 없습니다.</div>
              )}
            </div>
            {parsed.length > remaining && (
              <p className="text-xs text-destructive">⚠ {parsed.length}개 중 {remaining}개만 추가 가능합니다.</p>
            )}
            <DialogFooter className="gap-2">
              <button
                onClick={() => setParsed(null)}
                className="px-4 py-2 border border-border text-xs font-medium hover:bg-muted transition-colors rounded"
              >
                다시 입력
              </button>
              <button
                onClick={handleAdd}
                disabled={parsed.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 rounded"
              >
                <Check className="w-3.5 h-3.5" /> {Math.min(parsed.length, remaining)}개 추가
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
