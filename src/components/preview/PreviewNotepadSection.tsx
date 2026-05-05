const NOTEPAD_LINES = 7;

export function PreviewNotepadSection() {
  return (
    <section className="border-t border-border pt-5">
      <div className="min-h-[304px] px-1 pt-1">
        <div className="mb-3 w-[280px] bg-slate-600 px-4 py-2.5 text-[13px] font-black uppercase tracking-[0.05em] text-white">
          WIDE-NOTEPAD
        </div>
        <div className="mb-5 flex items-center gap-8 border-b border-black/50 pb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-black/80">
          <span>Subject / Title</span>
          <span className="h-px flex-1 bg-black/30" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: NOTEPAD_LINES }).map((_, idx) => (
            <div
              key={idx}
              className={`h-10 border-black/45 ${idx === NOTEPAD_LINES - 1 ? "" : "border-b"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
