import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, X, Pencil, Check } from "lucide-react";

interface PinnedPattern {
  id: string;
  tag: string;
  pinned_content: string;
  example_sentence: string | null;
}

const TAG_OPTIONS = [
  "관계대명사", "관계부사", "분사구문", "분사 후치수식", "수동태", "조동사+수동",
  "to부정사", "명사절", "가주어/진주어", "가목적어/진목적어", "5형식",
  "병렬구조", "전치사+동명사", "비교구문", "수일치", "생략", "숙어/표현", "기타",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PinnedPatternsManager({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<PinnedPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState(TAG_OPTIONS[0]);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTag, setEditTag] = useState("");
  const [editContent, setEditContent] = useState("");

  const fetchPatterns = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("syntax_patterns" as any)
      .select("id, tag, pinned_content, example_sentence")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setPatterns(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchPatterns();
  }, [open, user]);

  const handleDelete = async (id: string) => {
    await supabase.from("syntax_patterns" as any).delete().eq("id", id);
    setPatterns((prev) => prev.filter((p) => p.id !== id));
    toast.success("패턴이 삭제되었습니다.");
  };

  const handleAdd = async () => {
    if (!user || !newContent.trim()) return;
    const { error } = await supabase.from("syntax_patterns" as any).insert({
      user_id: user.id,
      tag: newTag,
      pinned_content: newContent.trim(),
    });
    if (error) {
      toast.error("저장 실패");
      return;
    }
    toast.success("패턴이 고정되었습니다.");
    setNewContent("");
    setAdding(false);
    fetchPatterns();
  };

  const startEditing = (p: PinnedPattern) => {
    setEditingId(p.id);
    setEditTag(p.tag);
    setEditContent(p.pinned_content);
  };

  const handleUpdate = async () => {
    if (!editingId || !editContent.trim()) return;
    const { error } = await supabase
      .from("syntax_patterns" as any)
      .update({ tag: editTag, pinned_content: editContent.trim() })
      .eq("id", editingId);
    if (error) {
      toast.error("수정 실패");
      return;
    }
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === editingId ? { ...p, tag: editTag, pinned_content: editContent.trim() } : p
      )
    );
    toast.success("패턴이 수정되었습니다.");
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-bold">
            고정 패턴 관리
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            고정된 설명 방식은 구문분석 자동생성 및 AI 수정에 항상 반영됩니다.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground animate-pulse text-center py-8">불러오는 중...</p>
          ) : patterns.length === 0 && !adding ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">고정된 패턴이 없습니다.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                구문분석 노트에서 📌 버튼을 눌러 패턴을 고정하세요.
              </p>
            </div>
          ) : (
            patterns.map((p) => (
              <div key={p.id} className="border border-border p-2.5 group/pattern">
                {editingId === p.id ? (
                  <div className="space-y-1.5">
                    <select
                      value={TAG_OPTIONS.includes(editTag) ? editTag : "__custom__"}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") setEditTag("");
                        else setEditTag(e.target.value);
                      }}
                      className="w-full bg-muted border border-border px-2 py-1 text-xs outline-none focus:border-foreground"
                    >
                      {TAG_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="__custom__">✏️ 직접 입력</option>
                    </select>
                    {!TAG_OPTIONS.includes(editTag) && (
                      <input
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                        placeholder="문법 사항을 직접 입력하세요"
                        className="w-full bg-muted border border-border px-2 py-1 text-xs outline-none focus:border-foreground"
                      />
                    )}
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="w-full bg-background border border-border px-2 py-1 text-xs outline-none focus:border-foreground resize-none"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleUpdate}
                        disabled={!editContent.trim()}
                        className="text-[10px] px-2 py-0.5 bg-foreground text-background hover:opacity-90 disabled:opacity-30 inline-flex items-center gap-0.5"
                      >
                        <Check className="w-2.5 h-2.5" />
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 inline-block mb-1">
                        {p.tag}
                      </span>
                      <p className="text-xs leading-relaxed text-foreground">{p.pinned_content}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => startEditing(p)}
                        className="p-1 text-muted-foreground/30 hover:text-foreground opacity-0 group-hover/pattern:opacity-100 transition-opacity"
                        title="수정"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/pattern:opacity-100 transition-opacity"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {adding && (
            <div className="border border-foreground/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">새 패턴</p>
                <button onClick={() => setAdding(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={TAG_OPTIONS.includes(newTag) ? newTag : "__custom__"}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setNewTag("");
                    } else {
                      setNewTag(e.target.value);
                    }
                  }}
                  className="flex-1 bg-muted border border-border px-2 py-1.5 text-xs outline-none focus:border-foreground"
                >
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
              </div>
              {!TAG_OPTIONS.includes(newTag) && (
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="문법 사항을 직접 입력하세요"
                  className="w-full bg-muted border border-border px-2 py-1.5 text-xs outline-none focus:border-foreground"
                />
              )}
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="예: 접속사+주어 생략, ~ing로 시작하는 분사구문"
                rows={2}
                className="w-full bg-background border border-border px-2 py-1.5 text-xs outline-none focus:border-foreground resize-none"
              />
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="text-[10px] px-3 py-1 bg-foreground text-background hover:opacity-90 disabled:opacity-30"
              >
                저장
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0">
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[10px] px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />
            직접 추가
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
