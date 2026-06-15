"use client";

function MenuItem({
  label,
  run,
  onClose,
}: {
  label: string;
  run: () => void;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        run();
        onClose();
      }}
      className="w-full text-left px-3 py-2.5 text-[14px] text-ink dark:text-cream/90 hover:bg-cream dark:hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );
}

/** Popover-Menü an einer Aufgabe (durch Long-Press geöffnet). */
export function TaskActionMenu({
  onDone,
  onDefer,
  onFail,
  onClose,
}: {
  onDone: () => void;
  onDefer: () => void;
  onFail: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute z-20 left-8 top-8 w-52 rounded-xl bg-white dark:bg-[#26241F] shadow-card ring-1 ring-black/10 dark:ring-white/10 overflow-hidden divide-y divide-black/5 dark:divide-white/5">
        <MenuItem label="✓ Erledigt" run={onDone} onClose={onClose} />
        <MenuItem label="→ Aufschieben" run={onDefer} onClose={onClose} />
        <MenuItem label="✕ Geht heute nicht" run={onFail} onClose={onClose} />
      </div>
    </>
  );
}
