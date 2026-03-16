import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Check, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { SyntaxNote } from "@/pages/Index";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestion?: string | null;
  suggestionNotes?: string[] | null;
}

interface SyntaxChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sentence: string;
  currentNotes: SyntaxNote[];
  fullPassage?: string;
  targetNoteIndex?: number | null;
  preset?: string;
  onApplySuggestion: (notes: SyntaxNote[]) => void;
}

export function SyntaxChat({
  open,
  onOpenChange,
  sentence,
  currentNotes,
  fullPassage,
  targetNoteIndex,
  preset,
  onApplySuggestion,
}: SyntaxChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const targetNote = targetNoteIndex !== null && targetNoteIndex !== undefined
    ? currentNotes[targetNoteIndex]
    : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, sentence, targetNoteIndex]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("grammar-chat", {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          sentence,
          currentNotes,
          fullPassage,
          targetNoteIndex: targetNoteIndex !== null ? targetNoteIndex : undefined,
          userId: session?.user?.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        suggestion: data.suggestion,
        suggestionNotes: data.suggestionNotes,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      toast.error(`채팅 오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = async (suggestionNotes: string[]) => {
    const aiDraft = currentNotes.map(n => n.content).join("\n");
    const finalVersion = suggestionNotes.join("\n");
    
    if (targetNote && suggestionNotes.length >= 1) {
      const newNote: SyntaxNote = { id: targetNote.id, content: suggestionNotes.join("\n") };
      onApplySuggestion([newNote]);
    } else {
      const newNotes: SyntaxNote[] = suggestionNotes.map((content, i) => ({
        id: i + 1,
        content,
      }));
      onApplySuggestion(newNotes);
    }
    toast.success("수정안이 적용되었습니다.");
    
    // Save learning example
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("learning_examples" as any).insert({
          user_id: session.user.id,
          type: "syntax",
          preset: preset || null,
          sentence,
          ai_draft: aiDraft,
          final_version: finalVersion,
        });
      }
    } catch (e) {
      console.error("Failed to save learning example:", e);
    }
  };

  const headerTitle = targetNote
    ? `${(targetNoteIndex ?? 0) + 1}번 구문분석 수정`
    : "구문분석 AI 수정";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-bold">{headerTitle}</SheetTitle>
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-1">
            {sentence}
          </p>
        </SheetHeader>

        {/* Target note or all notes */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border shrink-0 max-h-[150px] overflow-y-auto">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
            {targetNote ? `수정 대상 (${(targetNoteIndex ?? 0) + 1}번)` : "현재 구문분석"}
          </p>
          {targetNote ? (
            <p className="text-xs leading-relaxed text-foreground">
              <span className="font-bold mr-1">{(targetNoteIndex ?? 0) + 1}.</span>
              {targetNote.content}
            </p>
          ) : currentNotes.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">구문분석 내용이 없습니다.</p>
          ) : (
            <div className="space-y-0.5">
              {currentNotes.map((note, i) => (
                <p key={note.id} className="text-xs leading-relaxed text-foreground">
                  <span className="font-bold mr-1">{i + 1}.</span>
                  {note.content}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                {targetNote
                  ? `${(targetNoteIndex ?? 0) + 1}번 포인트에 대한 수정 요청이나 질문을 입력하세요.`
                  : "구문분석 수정 요청이나 문법 질문을 입력하세요."}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {(targetNote
                  ? ["더 짧게 줄여줘", "문법 용어 추가해줘", "다른 포인트로 바꿔줘"]
                  : ["더 짧게 줄여줘", "문법 용어 추가해줘", "내신 출제 포인트 강조해줘"]
                ).map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-[10px] px-2.5 py-1 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-t-lg rounded-bl-lg"
                    : "bg-muted border border-border rounded-t-lg rounded-br-lg"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-2">
                    <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:text-xs [&_p]:leading-relaxed [&_p]:my-1">
                      <ReactMarkdown>
                        {msg.suggestion
                          ? msg.content.replace(/\[수정안\][\s\S]*?\[\/수정안\]/, "").trim()
                          : msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.suggestionNotes && msg.suggestionNotes.length > 0 && (
                      <div className="mt-2 border border-border bg-background p-2.5 space-y-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                          수정안
                        </p>
                        <div className="space-y-0.5">
                          {msg.suggestionNotes.map((note, idx) => (
                            <p key={idx} className="text-xs leading-relaxed">
                              {!targetNote && <span className="font-bold mr-1">{idx + 1}.</span>}
                              {note}
                            </p>
                          ))}
                        </div>
                        <button
                          onClick={() => handleApply(msg.suggestionNotes!)}
                          className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-foreground text-background hover:opacity-90 transition-opacity"
                        >
                          <Check className="w-3 h-3" />
                          적용
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-t-lg rounded-br-lg px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={targetNote ? `${(targetNoteIndex ?? 0) + 1}번 수정 요청...` : "수정 요청 또는 문법 질문..."}
              rows={1}
              className="flex-1 bg-muted border border-border px-3 py-2 text-sm outline-none focus:border-foreground transition-colors resize-none min-h-[36px] max-h-[100px]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 100) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-2 bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-30 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
