import { useState, useEffect, useCallback } from "react";
import { Sparkles, X, MessageSquare, Pin } from "lucide-react";
import type { SyntaxNote } from "@/pages/Index";
import { SyntaxChat } from "./SyntaxChat";
import { PinnedPatternsManager } from "./PinnedPatternsManager";
import { reorderNotesByPosition } from "@/lib/syntax-superscript";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TAG_OPTIONS = [
  "관계대명사", "관계부사", "분사구문", "분사 후치수식", "수동태", "조동사+수동",
  "to부정사", "명사절", "가주어/진주어", "가목적어/진목적어", "5형식",
  "병렬구조", "전치사+동명사", "비교구문", "수일치", "생략", "숙어/표현", "기타",
];

function autoDetectTag(content: string): string {
  const c = content.toLowerCase();
  if (c.includes("관계대명사") || c.includes("주관대") || c.includes("목관대")) return "관계대명사";
  if (c.includes("관계부사")) return "관계부사";
  if (c.includes("분사구문")) return "분사구문";
  if (c.includes("후치수식") || c.includes("후치")) return "분사 후치수식";
  if (c.includes("조동사") && c.includes("수동")) return "조동사+수동";
  if (c.includes("수동태") || c.includes("be p.p")) return "수동태";
  if (c.includes("to부정사") || c.includes("to-v")) return "to부정사";
  if (c.includes("명사절")) return "명사절";
  if (c.includes("가주어") || c.includes("진주어")) return "가주어/진주어";
  if (c.includes("가목적어") || c.includes("진목적어")) return "가목적어/진목적어";
  if (c.includes("5형식") || c.includes("목적격보어")) return "5형식";
  if (c.includes("병렬")) return "병렬구조";
  if (c.includes("전치사") && c.includes("동명사")) return "전치사+동명사";
  if (c.includes("비교") || c.includes("최상급")) return "비교구문";
  if (c.includes("수일치")) return "수일치";
  if (c.includes("생략")) return "생략";
  return "기타";
}

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
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [pinningId, setPinningId] = useState<number | null>(null);
  const [pinTag, setPinTag] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  const fetchCustomTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("syntax_patterns").select("tag").eq("user_id", user.id);
    if (data) {
      const unique = Array.from(new Set(data.map((d: any) => d.tag)));
      setCustomTags(unique.filter((t) => !TAG_OPTIONS.includes(t)));
    }
  }, [user]);

  useEffect(() => { fetchCustomTags(); }, [fetchCustomTags]);

  const handleDeleteNote = (id: number) => {
    const filtered = notes.filter((n) => n.id !== id);
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
      const updated = notes.map((n, i) =>
        i === selectedNoteIndex ? { ...n, content: newNotes[0].content } : n
      );
      onChange(updated);
    } else {
      onChange(newNotes);
    }
  };

  const handlePinNote = async () => {
    if (!user || !pinContent.trim()) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    const tag = pinTag || "기타";
    const { error } = await supabase.from("syntax_patterns" as any).insert({
      user_id: user.id,
      tag,
      pinned_content: pinContent.trim(),
      example_sentence: sentence || null,
    });
    if (error) {
      toast.error("패턴 고정 실패");
    } else {
      toast.success(`"${tag}" 패턴이 고정되었습니다.`);
    }
    setPinningId(null);
    setPinTag("");
    setPinContent("");
  };

  const startPinning = (note: SyntaxNote) => {
    const detected = autoDetectTag(note.content);
    setPinTag(detected);
    setPinContent(note.content);
    setPinningId(note.id);
  };

  return (
    <div className="bg-muted/50 border border-border rounded-xl p-3 relative">
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
            <button
              onClick={() => setPatternsOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              title="고정 패턴 관리"
            >
              <Pin className="w-3 h-3" />
            </button>
            {onGenerate && (
              <button
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40"
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
                className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
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
                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                {pinningId === note.id ? (
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <div className="flex items-center gap-1">
                        <select
                          value={pinTag}
                          onChange={(e) => setPinTag(e.target.value)}
                          className="text-[9px] bg-muted border border-border px-1 py-0.5 outline-none flex-1"
                        >
                          {TAG_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          onClick={handlePinNote}
                          className="text-[9px] px-1.5 py-0.5 bg-foreground text-background hover:opacity-90 shrink-0"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => { setPinningId(null); setPinTag(""); setPinContent(""); }}
                          className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <textarea
                        value={pinContent}
                        onChange={(e) => setPinContent(e.target.value)}
                        rows={2}
                        className="w-full bg-background border border-border px-1.5 py-1 text-[10px] outline-none focus:border-foreground resize-none"
                        placeholder="고정할 내용을 수정하세요"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => startPinning(note)}
                      className="p-0.5 text-muted-foreground/30 hover:text-foreground opacity-0 group-hover/note:opacity-100 transition-opacity"
                      title="이 패턴 고정"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="shrink-0 p-0.5 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity"
                    title="삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
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

      <PinnedPatternsManager open={patternsOpen} onOpenChange={setPatternsOpen} />
    </div>
  );
}
