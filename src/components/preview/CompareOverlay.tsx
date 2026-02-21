interface Props {
  title: string;
  oldContent: React.ReactNode;
  newContent: React.ReactNode;
  onAccept: () => void;
  onReject: () => void;
}

export function CompareOverlay({ title, oldContent, newContent, onAccept, onReject }: Props) {
  return (
    <div className="border border-border bg-card p-4 space-y-3 mt-2">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {title} — 새 결과 비교
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] text-muted-foreground mb-1.5 uppercase">기존</p>
          <div className="text-xs opacity-60">{oldContent}</div>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground mb-1.5 uppercase">새 결과</p>
          <div className="text-xs">{newContent}</div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onReject} className="text-[10px] px-3 py-1 border border-border text-muted-foreground hover:text-foreground transition-colors">
          유지
        </button>
        <button onClick={onAccept} className="text-[10px] px-3 py-1 bg-foreground text-background hover:opacity-90 transition-opacity">
          적용
        </button>
      </div>
    </div>
  );
}
