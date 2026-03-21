import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Check, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestion?: string | null;
}

interface HongTChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sentence: string;
  currentExplanation: string;
  fullPassage?: string;
  preset?: string;
  teacherLabel?: string;
  onApplySuggestion: (suggestion: string) => void;
}

export function HongTChat({
  open,
  onOpenChange,
  sentence,
  currentExplanation,
  fullPassage,
  preset,
  onApplySuggestion,
  teacherLabel = "홍T",
}: HongTChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Reset messages when the sheet opens with new context
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, sentence]);

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
      const { data, error } = await supabase.functions.invoke("hongt-chat", {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          sentence,
          currentExplanation,
          fullPassage,
          userId: session?.user?.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        suggestion: data.suggestion,
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

  const handleApply = async (suggestion: string) => {
    onApplySuggestion(suggestion);
    toast.success("수정안이 적용되었습니다.");
    
    // Save learning example
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("learning_examples" as any).insert({
          user_id: session.user.id,
          type: "hongt",
          preset: preset || null,
          sentence,
          ai_draft: currentExplanation,
          final_version: suggestion,
        });
      }
    } catch (e) {
      console.error("Failed to save learning example:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-bold">{teacherLabel} 대화 수정</DialogTitle>
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-1">
            {sentence}
          </p>
        </DialogHeader>

        {/* Current explanation */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
            현재 {teacherLabel} 설명
          </p>
          <p className="text-xs leading-relaxed text-foreground">
            {currentExplanation || "아직 설명이 없습니다."}
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                수정 요청이나 질문을 입력하세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {["더 짧게 줄여줘", "더 쉽게 설명해줘", "핵심만 남겨줘"].map((q) => (
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
                    {msg.suggestion && (
                      <div className="mt-2 border border-border bg-background p-2.5 space-y-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                          수정안
                        </p>
                        <p className="text-xs leading-relaxed">{msg.suggestion}</p>
                        <button
                          onClick={() => handleApply(msg.suggestion!)}
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
              placeholder="수정 요청 또는 질문..."
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
      </DialogContent>
    </Dialog>
  );
}
