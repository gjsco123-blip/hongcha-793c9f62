const NOTEPAD_LINES = 7;

export function PreviewNotepadSection() {
  return (
    <section className="border-t border-border pt-5">
      <div className="min-h-[304px] px-1 pt-1">
        <div className="mb-4 inline-flex items-center justify-center rounded-[6px] bg-black px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
          Notepad
        </div>
        <div className="space-y-0">
          {Array.from({ length: NOTEPAD_LINES }).map((_, idx) => (
            <div
              key={idx}
              className={`h-9 border-black/70 ${idx === NOTEPAD_LINES - 1 ? "" : "border-b"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
