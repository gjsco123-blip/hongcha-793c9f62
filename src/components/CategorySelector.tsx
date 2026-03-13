import { useState } from "react";
import { ChevronDown, Plus, Trash2, LogOut, ChevronRight, BookOpen, School as SchoolIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { School, Passage } from "@/hooks/useCategories";

interface CategorySelectorProps {
  schools: School[];
  passages: Passage[];
  selectedSchoolId: string | null;
  selectedPassageId: string | null;
  onSelectSchool: (id: string) => void;
  onSelectPassage: (id: string) => void;
  onAddSchool: (name: string) => Promise<any>;
  onAddPassage: (schoolId: string, name: string) => Promise<any>;
  onDeleteSchool: (id: string) => Promise<void>;
  onDeletePassage: (id: string) => Promise<void>;
  onClearPassage?: () => void;
}

/* ── Compact header bar (shown when passage is selected) ── */
export function CategoryHeaderBar({
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
}: CategorySelectorProps) {
  const { signOut, user } = useAuth();
  const [addingSchool, setAddingSchool] = useState(false);
  const [addingPassage, setAddingPassage] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

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
  };

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
                      onClick={() => onDeleteSchool(s.id)}
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
                {passages.map((p) => (
                  <div key={p.id} className="group flex items-center">
                    <button
                      onClick={() => onSelectPassage(p.id)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50"
                    >
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
                    </button>
                    <button
                      onClick={() => onDeletePassage(p.id)}
                      className="p-2 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add passage */}
              {addingPassage ? (
                <div className="flex items-center gap-2 mt-3 px-4">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPassage();
                      if (e.key === "Escape") { setAddingPassage(false); setNewName(""); }
                    }}
                    placeholder="지문 이름 입력"
                    className="flex-1 h-10 px-3 border-b border-border bg-transparent text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <button
                    onClick={handleAddPassage}
                    className="h-10 px-4 bg-foreground text-background text-xs font-medium hover:opacity-85 transition-opacity"
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
