import { useState } from "react";
import { Sparkles, SpellCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HongTSectionProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  generating?: boolean;
  onDelete?: () => void;
}

export function HongTSection({ value, onChange, onGenerate, generating, onDelete }: HongTSectionProps) {
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSpellCheck = async () => {
    if (!value.trim()) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("spellcheck", {
        body: { text: value },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (data.corrected && data.corrected !== value) {
        onChange(data.corrected);
        toast.success("맞춤법 교정이 적용되었습니다.");
      } else {
        toast.info("교정할 내용이 없습니다.");
      }
    } catch (e: any) {
      toast.error(`맞춤법 검사 실패: ${e.message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-muted/50 border border-border p-3 relative group/hongt">
      {generating && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-10">
          <span className="text-xs text-muted-foreground animate-pulse">
            홍T 해설 생성 중...
          </span>
        </div>
      )}
      <div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="absolute top-1.5 right-1.5 p-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/hongt:opacity-100 transition-opacity"
            title="홍T 삭제"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-4 bg-foreground shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              홍T
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {onGenerate && (
              <button
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-3 h-3" />
                자동 생성
              </button>
            )}
            {editing && value.trim() && (
              <button
                onClick={handleSpellCheck}
                disabled={checking}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40"
              >
                <SpellCheck className="w-3 h-3" />
                {checking ? "검사 중..." : "맞춤법"}
              </button>
            )}
            <button
              onClick={() => setEditing((prev) => !prev)}
              className="text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            >
              {editing ? "완료" : "수정"}
            </button>
          </div>
        </div>
        <div className="ml-[22px]">
          {editing ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border px-3 py-2 text-sm font-sans leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
              placeholder="홍T 해설을 입력하세요..."
            />
          ) : (
            <p className="text-sm font-sans leading-relaxed text-foreground whitespace-pre-wrap">
              {value || <span className="text-muted-foreground/50">홍T 해설이 없습니다.</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
