export function PreviewNotepadSection() {
  return (
    <section className="border-t border-border pt-5">
      <div className="relative min-h-[304px] pl-24 pt-2">
        <div className="absolute left-0 top-8 text-[12px] font-extrabold uppercase tracking-[0.08em] text-black/80">
          WIDE-NOTEPAD
        </div>
        <div className="relative min-h-[288px] overflow-hidden rounded-[18px] border border-[#222] bg-white">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(107,114,128,0.22) 0, rgba(107,114,128,0.22) 1px, transparent 1px, transparent 22px), repeating-linear-gradient(to bottom, rgba(107,114,128,0.22) 0, rgba(107,114,128,0.22) 1px, transparent 1px, transparent 22px)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
