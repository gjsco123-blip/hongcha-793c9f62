import { useState } from "react";
import { ChevronDown, Plus, Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { School, Passage } from "@/hooks/useCategories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}

export function CategorySelector({
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
  const selectedPassage = passages.find((p) => p.id === selectedPassageId);

  const handleAddSchool = async () => {
    if (!newName.trim()) return;
    const school = await onAddSchool(newName.trim());
    if (school) {
      onSelectSchool(school.id);
    }
    setNewName("");
    setAddingSchool(false);
  };

  const handleAddPassage = async () => {
    if (!newName.trim() || !selectedSchoolId) return;
    const passage = await onAddPassage(selectedSchoolId, newName.trim());
    if (passage) {
      onSelectPassage(passage.id);
    }
    setNewName("");
    setAddingPassage(false);
  };

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {/* School dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border rounded-sm">
          {selectedSchool?.name || "학교 선택"}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          {schools.map((s) => (
            <DropdownMenuItem
              key={s.id}
              className="flex items-center justify-between group"
              onClick={() => onSelectSchool(s.id)}
            >
              <span className={s.id === selectedSchoolId ? "font-semibold" : ""}>
                {s.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSchool(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {addingSchool ? (
            <div className="px-2 py-1.5 flex gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSchool();
                  if (e.key === "Escape") { setAddingSchool(false); setNewName(""); }
                }}
                placeholder="학교 이름"
                className="flex-1 text-xs px-1.5 py-1 border border-border bg-background outline-none"
              />
              <button onClick={handleAddSchool} className="text-xs px-2 py-1 bg-foreground text-background">
                추가
              </button>
            </div>
          ) : (
            <DropdownMenuItem onClick={() => setAddingSchool(true)}>
              <Plus className="w-3 h-3 mr-1.5" />
              학교 추가
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      {selectedSchoolId && (
        <>
          <span className="text-muted-foreground/40">›</span>

          {/* Passage dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border rounded-sm">
              {selectedPassage?.name || "지문 선택"}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {passages.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className="flex items-center justify-between group"
                  onClick={() => onSelectPassage(p.id)}
                >
                  <span className={p.id === selectedPassageId ? "font-semibold" : ""}>
                    {p.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePassage(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {addingPassage ? (
                <div className="px-2 py-1.5 flex gap-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPassage();
                      if (e.key === "Escape") { setAddingPassage(false); setNewName(""); }
                    }}
                    placeholder="지문 이름"
                    className="flex-1 text-xs px-1.5 py-1 border border-border bg-background outline-none"
                  />
                  <button onClick={handleAddPassage} className="text-xs px-2 py-1 bg-foreground text-background">
                    추가
                  </button>
                </div>
              ) : (
                <DropdownMenuItem onClick={() => setAddingPassage(true)}>
                  <Plus className="w-3 h-3 mr-1.5" />
                  지문 추가
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {/* Sign out */}
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
