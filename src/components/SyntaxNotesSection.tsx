import { useState } from "react";
import { Sparkles, X, MessageSquare } from "lucide-react";
import type { SyntaxNote } from "@/pages/Index";
import { SyntaxChat } from "./SyntaxChat";
import { reorderNotesByPosition } from "@/lib/syntax-superscript";

interface SyntaxNotesSectionProps {
  notes: SyntaxNote[];
  onChange: (notes: SyntaxNote[]) => void;
  onGenerate?: () => void;
  generating?: boolean;
  sentence?: string;
  fullPassage?: string;
  preset?: string;
}

export function SyntaxNotesSection({ notes, onChange, onGenerate, generating, sentence, fullPassage, preset }: SyntaxNotesSectionProps) {
  const [editing, setEditing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);

  const handleDeleteNote = (id: number) => {
    const filtered = notes.filter((n) => n.id !== id);
    // 문장 내 등장 순서로 자동 정렬
    onChange(sentence ? reorderNotesByPosition(filtered, sentence) : filtered.map((n, i) => ({ ...n, id: i + 1 })));
  };

  const handleEditNote = (id: number, content: string) => {
    onChange(notes.map((n) => (n.id === id ? { ...n, content } : n)));
  };

  const handleNoteClick = (index: number) => {
    setSelectedNoteIndex(index);
    setChatOpen(true);
  };

  const handleApplySuggestion = (newNotes: SyntaxNote[]) => {
    if (selectedNoteIndex !== null && newNotes.length === 1) {
      // Replace only the selected note
      const updated = notes.map((n, i) =>
        i === selectedNoteIndex ? { ...n, content: newNotes[0].content } : n
      );
      onChange(updated);
    } else {
      onChange(newNotes);
    }
  };

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
            {notes.length > 0 && sentence && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                번호 클릭 → AI 수정
              </span>
            )}
            {notes.length > 0 && (
              <button
                onClick={() => setEditing((prev) => !prev)}
                className="text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                {editing ? "완료" : "수정"}
              </button>
            )}
          </div>
        </div>
        <div className="ml-[22px] space-y-1.5">
          {notes.length === 0 ? (
            <p className="text-sm font-sans leading-relaxed text-muted-foreground/50">
              구문분석 내용이 없습니다.
            </p>
          ) : (
            notes.map((note, index) => (
              <div key={note.id} className="flex items-start gap-2 group/note">
                {sentence ? (
                  <button
                    onClick={() => handleNoteClick(index)}
                    className="text-xs font-bold text-foreground shrink-0 mt-0.5 w-4 hover:text-primary underline-offset-2 hover:underline cursor-pointer transition-colors"
                    title="클릭하여 AI 수정"
                  >
                    {index + 1}.
                  </button>
                ) : (
                  <span className="text-xs font-bold text-foreground shrink-0 mt-0.5 w-4">
                    {index + 1}.
                  </span>
                )}
                {editing ? (
                  <textarea
                    value={note.content}
                    onChange={(e) => handleEditNote(note.id, e.target.value)}
                    rows={2}
                    className="flex-1 bg-background border border-border px-2 py-1 text-sm font-sans leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
                  />
                ) : (
                  <p className="flex-1 text-sm font-sans leading-relaxed text-foreground whitespace-pre-wrap">
                    {note.content.replace(/^\s*[•·\-\*]\s*/, "")}
                  </p>
                )}
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="shrink-0 p-0.5 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity mt-0.5"
                  title="삭제"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {sentence && (
        <SyntaxChat
          open={chatOpen}
          onOpenChange={(open) => {
            setChatOpen(open);
            if (!open) setSelectedNoteIndex(null);
          }}
          sentence={sentence}
          currentNotes={notes}
          fullPassage={fullPassage}
          targetNoteIndex={selectedNoteIndex}
          preset={preset}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
    </div>
  );
}
