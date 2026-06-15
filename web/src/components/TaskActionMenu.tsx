"use client";

const MENU_WIDTH = 208; // w-52
const MENU_HEIGHT = 123; // three menu items, ~41px each
const MENU_MARGIN = 8;

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
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="w-full text-left px-3 py-2.5 text-[14px] text-ink dark:text-cream/90 hover:bg-cream dark:hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );
}

/** Popover-Menü an einer Aufgabe (durch Long-Press geöffnet). */
export function TaskActionMenu({
  position,
  onDone,
  onDefer,
  onFail,
  onClose,
}: {
  position: { x: number; y: number };
  onDone: () => void;
  onDefer: () => void;
  onFail: () => void;
  onClose: () => void;
}) {
  // Clamp so the popover never overflows the viewport's right/bottom edge.
  const left =
    typeof window !== "undefined"
      ? Math.max(MENU_MARGIN, Math.min(position.x, window.innerWidth - MENU_WIDTH - MENU_MARGIN))
      : position.x;
  const top =
    typeof window !== "undefined"
      ? Math.max(MENU_MARGIN, Math.min(position.y, window.innerHeight - MENU_HEIGHT - MENU_MARGIN))
      : position.y;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      />
      <div
        className="fixed z-50 w-52 rounded-xl bg-white dark:bg-[#26241F] shadow-card ring-1 ring-black/10 dark:ring-white/10 overflow-hidden divide-y divide-black/5 dark:divide-white/5"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <MenuItem label="✓ Erledigt" run={onDone} onClose={onClose} />
        <MenuItem label="→ Aufschieben" run={onDefer} onClose={onClose} />
        <MenuItem label="✕ Geht heute nicht" run={onFail} onClose={onClose} />
      </div>
    </>
  );
}
