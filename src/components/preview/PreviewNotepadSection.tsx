const NOTEPAD_LINES = 7;

export function PreviewNotepadSection() {
  return (
    <section className="border-t border-border pt-5">
      <div className="min-h-[304px] px-1 pt-1">
        <div className="mb-4 border-y border-black/50 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-black/80">
          WIDE-NOTEPAD
        </div>
        <div className="space-y-0">
          {Array.from({ length: NOTEPAD_LINES }).map((_, idx) => (
            <div
              key={idx}
              className="h-10 border-b border-black/45"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
