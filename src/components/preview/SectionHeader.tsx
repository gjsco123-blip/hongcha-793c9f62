import { Loader2, RefreshCw } from "lucide-react";
import type { SectionStatus } from "./types";

interface Props {
  title: string;
  status: SectionStatus;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  children?: React.ReactNode;
}

export function SectionHeader({ title, status, onRegenerate, isRegenerating, children }: Props) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-2">
        {title}
        {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />}
      </h2>
      <div className="flex-1" />
      {children}
      {onRegenerate && status === "done" && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin" : ""}`} />
          재생성
        </button>
      )}
    </div>
  );
}
