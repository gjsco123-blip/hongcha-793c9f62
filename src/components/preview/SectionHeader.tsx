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
        {status === "loading" && <span className="text-muted-foreground">...</span>}
      </h2>
      <div className="flex-1" />
      {children}
      {onRegenerate && status === "done" && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40"
        >
          {isRegenerating ? "재생성 중..." : "재생성"}
        </button>
      )}
    </div>
  );
}
