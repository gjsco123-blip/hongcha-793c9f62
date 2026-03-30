import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Trash2, LogOut, ChevronRight, BookOpen, School as SchoolIcon, GripVertical, Pencil, Check, X, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { School, Passage } from "@/hooks/useCategories";
import { useBatchPdfExport } from "@/hooks/useBatchPdfExport";
import { useTeacherLabel } from "@/hooks/useTeacherLabel";
import { Checkbox } from "@/components/ui/checkbox";

interface CategorySelectorProps {
  schools: School[];
  passages: Passage[];
  selectedSchoolId: string | null;
  selectedPassageId: string | null;
  onSelectSchool: (id: string) => void;
  onSelectPassage: (id: string) => void;
  onAddSchool: (name: string) => Promise<any>;
  onAddPassage: (schoolId: string, name: string) => Promise<any>;
  onRenamePassage: (id: string, name: string) => Promise<boolean>;
  onDeleteSchool: (id: string) => Promise<void>;
  onDeletePassage: (id: string) => Promise<void>;
  onReorderPassages?: (ids: string[]) => Promise<void>;
  onClearPassage?: () => void;
}

/* ── Compact header bar (shown when passage is selected) ── */
export function CategoryHeaderBar({
  schools,
  passages,
  selectedSchoolId,
  selectedPassageId,
  onClearPassage,
}: CategorySelectorProps) {
  const { signOut, user } = useAuth();
  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);
  const selectedPassage = passages.find((p) => p.id === selectedPassageId);

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={onClearPassage}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <SchoolIcon className="w-3.5 h-3.5" />
        <span className="font-medium">{selectedSchool?.name}</span>
        <ChevronRight className="w-3 h-3 opacity-40" />
        <BookOpen className="w-3.5 h-3.5" />
        <span className="font-medium">{selectedPassage?.name}</span>
      </button>
      <button
        onClick={signOut}
        title={user?.email}
        className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Autocomplete dropdown for passage name input ── */
function PassageNameAutocomplete({
  value,
  suggestions,
  highlightIdx,
  onSelect,
  visible,
}: {
  value: string;
  suggestions: string[];
  highlightIdx: number;
  onSelect: (name: string) => void;
  visible: boolean;
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  useEffect(() => {
    if (highlightIdx < 0) return;
    itemRefs.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, filtered.length]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-md z-10 max-h-40 overflow-y-auto">
      {filtered.map((name, i) => (
        <button
          key={name}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          onMouseDown={(e) => { e.preventDefault(); onSelect(name); }}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${i === highlightIdx ? "bg-muted/60" : ""}`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/* ── Full-page selection screen (shown when no passage selected) ── */
export function CategoryFullScreen({
  schools,
  passages,
  selectedSchoolId,
  selectedPassageId,
  onSelectSchool,
  onSelectPassage,
  onAddSchool,
  onAddPassage,
  onDeleteSchool,
  onDeletePassage,
  onRenamePassage,
  onReorderPassages,
}: CategorySelectorProps) {
  const { signOut, user } = useAuth();
  const { teacherLabel } = useTeacherLabel();
  const { batchExportSyntax, batchExportPreview, batchExportCombined, batchExportWorkbook } = useBatchPdfExport();
  const [addingSchool, setAddingSchool] = useState(false);
  const [addingPassage, setAddingPassage] = useState(false);
  const [newName, setNewName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingPassageId, setEditingPassageId] = useState<string | null>(null);
  const [editingPassageName, setEditingPassageName] = useState("");
  const [savingPassageId, setSavingPassageId] = useState<string | null>(null);
  const [passageHighlightIdx, setPassageHighlightIdx] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);
  const passageSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return [...passages]
      .sort((a, b) => {
        const bTime = Date.parse(b.created_at || "") || 0;
        const aTime = Date.parse(a.created_at || "") || 0;
        return bTime - aTime;
      })
      .map((p) => p.name)
      .filter((name) => {
        const key = name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [passages]);

  const filteredPassageSuggestions = useMemo(() => {
    const query = newName.trim().toLowerCase();
    return query
      ? passageSuggestions.filter((s) => s.toLowerCase().includes(query))
      : passageSuggestions;
  }, [newName, passageSuggestions]);

  const handleAddSchool = async () => {
    if (!newName.trim()) return;
    const school = await onAddSchool(newName.trim());
    if (school) onSelectSchool(school.id);
    setNewName("");
    setAddingSchool(false);
  };

  const handleAddPassage = async () => {
    if (!newName.trim() || !selectedSchoolId) return;
    const passage = await onAddPassage(selectedSchoolId, newName.trim());
    if (passage) onSelectPassage(passage.id);
    setNewName("");
    setAddingPassage(false);
    setShowSuggestions(false);
    setPassageHighlightIdx(-1);
  };

  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx || !onReorderPassages) return;
    const ids = passages.map((p) => p.id);
    const [moved] = ids.splice(dragIdx, 1);
    ids.splice(dropIdx, 0, moved);
    onReorderPassages(ids);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDeleteSchoolConfirm = async (school: School) => {
    if (!window.confirm(`'${school.name}' 학교를 삭제할까요?`)) return;
    await onDeleteSchool(school.id);
  };

  const handleDeletePassageConfirm = async (passage: Passage) => {
    if (!window.confirm(`'${passage.name}' 지문을 삭제할까요?`)) return;
    await onDeletePassage(passage.id);
  };

  const startPassageRename = (passage: Passage) => {
    setEditingPassageId(passage.id);
    setEditingPassageName(passage.name);
  };

  const cancelPassageRename = () => {
    setEditingPassageId(null);
    setEditingPassageName("");
    setSavingPassageId(null);
  };

  const submitPassageRename = async (passage: Passage) => {
    const next = editingPassageName.trim();
    if (!next) return;
    if (next === passage.name) {
      cancelPassageRename();
      return;
    }
    setSavingPassageId(passage.id);
    const ok = await onRenamePassage(passage.id, next);
    if (ok) cancelPassageRename();
    else setSavingPassageId(null);
  };

  useEffect(() => {
    setPassageHighlightIdx(-1);
  }, [newName]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-sm font-semibold tracking-[0.15em] uppercase text-foreground">Syntax</h1>
        <button
          onClick={signOut}
          title={user?.email}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="hidden sm:inline">{user?.email}</span>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center pt-[12vh] px-6">
        <div className="w-full max-w-md">
          {/* Step 1: School selection */}
          {!selectedSchoolId ? (
            <div className="animate-fade-in">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Step 1</p>
              <h2 className="text-2xl font-bold text-foreground mb-8">학교를 선택하세요</h2>

              <div className="space-y-1">
                {schools.map((s) => (
                  <div key={s.id} className="group flex items-center">
                    <button
                      onClick={() => onSelectSchool(s.id)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50"
                    >
                      <SchoolIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchoolConfirm(s)}
                      className="p-2 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add school */}
              {addingSchool ? (
                <div className="flex items-center gap-2 mt-3 px-4">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSchool();
                      if (e.key === "Escape") { setAddingSchool(false); setNewName(""); }
                    }}
                    placeholder="학교 이름 입력"
                    className="flex-1 h-10 px-3 border-b border-border bg-transparent text-sm outline-none focus:border-foreground transition-colors"
                  />
                   <button
                    onClick={handleAddSchool}
                    className="h-10 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-85 transition-opacity"
                  >
                    추가
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSchool(true)}
                  className="flex items-center gap-2 mt-3 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  새 학교 추가
                </button>
              )}
            </div>
          ) : (
            /* Step 2: Passage selection */
            <div className="animate-fade-in">
              <button
                onClick={() => { onSelectSchool(""); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                ← 학교 목록으로
              </button>

              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Step 2</p>
              <div className="flex items-center gap-2 mb-8">
                <SchoolIcon className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-2xl font-bold text-foreground">{selectedSchool?.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">지문을 선택하세요</p>

              <div className="space-y-1">
                {passages.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`group flex items-center ${overIdx === idx && dragIdx !== idx ? "border-t-2 border-primary" : ""}`}
                    draggable={!editingPassageId}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(idx); }}
                  >
                    <span className="p-1.5 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    {editingPassageId === p.id ? (
                      <div className="flex-1 flex items-center gap-2 px-2 py-2 border-b border-border/50">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <input
                          autoFocus
                          value={editingPassageName}
                          onChange={(e) => setEditingPassageName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitPassageRename(p);
                            if (e.key === "Escape") cancelPassageRename();
                          }}
                          className="flex-1 h-8 px-2 border border-border rounded bg-background text-sm outline-none focus:border-foreground"
                        />
                        <button
                          onClick={() => submitPassageRename(p)}
                          disabled={!editingPassageName.trim() || savingPassageId === p.id}
                          className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          title="이름 저장"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelPassageRename}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                          title="취소"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onSelectPassage(p.id)}
                          className="flex-1 flex items-center gap-3 px-2 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50"
                        >
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{p.name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
                        </button>
                        <button
                          onClick={() => startPassageRename(p)}
                          className="p-2 text-muted-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                          title="이름 변경"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePassageConfirm(p)}
                          className="p-2 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add passage with autocomplete */}
              {addingPassage ? (
                <div className="relative flex items-center gap-2 mt-3 px-4">
                  <div className="relative flex-1">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => { setShowSuggestions(false); setPassageHighlightIdx(-1); }, 150)}
                      onKeyDown={(e) => {
                        if (showSuggestions && filteredPassageSuggestions.length > 0) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setShowSuggestions(true);
                            setPassageHighlightIdx((prev) =>
                              prev < 0 ? 0 : Math.min(prev + 1, filteredPassageSuggestions.length - 1)
                            );
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setShowSuggestions(true);
                            setPassageHighlightIdx((prev) =>
                              prev <= 0 ? filteredPassageSuggestions.length - 1 : prev - 1
                            );
                            return;
                          }
                          if (e.key === "Enter" && passageHighlightIdx >= 0) {
                            e.preventDefault();
                            const selected = filteredPassageSuggestions[passageHighlightIdx];
                            if (selected) {
                              setNewName(selected);
                              setShowSuggestions(false);
                              setPassageHighlightIdx(-1);
                            }
                            return;
                          }
                        }
                        if (e.key === "Enter") handleAddPassage();
                        if (e.key === "Escape") { setAddingPassage(false); setNewName(""); setShowSuggestions(false); setPassageHighlightIdx(-1); }
                      }}
                      placeholder="지문 이름 입력"
                      className="w-full h-10 px-3 border-b border-border bg-transparent text-sm outline-none focus:border-foreground transition-colors"
                    />
                    <PassageNameAutocomplete
                      value={newName}
                      suggestions={passageSuggestions}
                      highlightIdx={passageHighlightIdx}
                      onSelect={(name) => { setNewName(name); setShowSuggestions(false); }}
                      visible={showSuggestions}
                    />
                  </div>
                   <button
                    onClick={handleAddPassage}
                    className="h-10 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-85 transition-opacity"
                  >
                    추가
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingPassage(true)}
                  className="flex items-center gap-2 mt-3 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  새 지문 추가
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
