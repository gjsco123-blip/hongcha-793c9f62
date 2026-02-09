import { useState } from "react";

interface SyntaxNotesSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function SyntaxNotesSection({ value, onChange }: SyntaxNotesSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-muted/50 border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          구문분석
        </span>
        <button
          onClick={() => setEditing((prev) => !prev)}
          className="text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          {editing ? "완료" : "수정"}
        </button>
      </div>
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
  );
}
