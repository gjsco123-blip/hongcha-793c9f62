import { useState } from "react";
import { Sparkles } from "lucide-react";

interface SyntaxNotesSectionProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  generating?: boolean;
}

export function SyntaxNotesSection({ value, onChange, onGenerate, generating }: SyntaxNotesSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-muted/50 border border-border p-3 relative">
      {generating && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-10">
          <span className="text-xs text-muted-foreground animate-pulse">
            구문분석 생성 중...
          </span>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-4 bg-foreground shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              구문분석
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
              placeholder="구문분석 내용을 입력하세요..."
            />
          ) : (
            <p className="text-sm font-sans leading-relaxed text-foreground whitespace-pre-wrap">
              {value || <span className="text-muted-foreground/50">구문분석 내용이 없습니다.</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
