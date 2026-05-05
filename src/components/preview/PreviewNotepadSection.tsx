const NOTEPAD_LINES = 11;

export function PreviewNotepadSection() {
  return (
    <section className="border-t border-border pt-5">
      <div className="min-h-[336px] rounded-md border-2 border-black px-4 pb-4 pt-3">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-black">Notepad</div>
        <div>
          {Array.from({ length: NOTEPAD_LINES }).map((_, idx) => (
            <div
              key={idx}
              className={`h-7 border-black/80 ${idx === NOTEPAD_LINES - 1 ? "" : "border-b"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
