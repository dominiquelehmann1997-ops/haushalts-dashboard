"use client";

import { useState, startTransition } from "react";
import type { Note } from "@/lib/data";
import { createNoteAction, updateNoteAction, deleteNoteAction, togglePinNoteAction } from "@/app/actions/notes";
import { Card } from "@/components/ui";

export function NotesEditor({ notes }: { notes: Note[] }) {
  const [draft, setDraft] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      await createNoteAction({ text });
      setDraft("");
    });
  };

  return (
    <Card>
      <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-3">Notizen</h2>

      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Neue Notiz …"
          className="flex-1 min-w-0 text-[14px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
        />
        <button type="submit" disabled={!draft.trim()} className="px-3 rounded-xl bg-ink text-cream dark:bg-cream dark:text-ink font-semibold text-[18px] disabled:opacity-40">
          +
        </button>
      </form>

      <ul className="space-y-2">
        {notes.map((n) => (
          <NoteItem key={n.id} note={n} />
        ))}
        {notes.length === 0 && <li className="py-3 text-center text-ink-faint text-[13px]">Noch keine Notizen.</li>}
      </ul>
    </Card>
  );
}

function NoteItem({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await updateNoteAction(note.id, { text: t });
      setEditing(false);
    });
  };

  return (
    <li className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-500/[0.07] ring-1 ring-amber-200/50 dark:ring-amber-500/10">
      <button
        type="button"
        onClick={() => startTransition(() => togglePinNoteAction(note.id))}
        aria-label="Anpinnen"
        className={`shrink-0 text-[14px] ${note.pinned ? "opacity-100" : "opacity-30"}`}
      >
        📌
      </button>
      {editing ? (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          autoFocus
          className="flex-1 min-w-0 text-[14px] bg-white/70 dark:bg-white/[0.06] rounded-lg px-2 py-1 outline-none text-ink dark:text-cream/90"
        />
      ) : (
        <span onClick={() => setEditing(true)} className="flex-1 min-w-0 text-[14px] text-ink dark:text-cream/85 leading-snug">
          {note.text}
        </span>
      )}
      <button
        type="button"
        onClick={() => startTransition(() => deleteNoteAction(note.id))}
        aria-label="Löschen"
        className="shrink-0 text-ink-faint hover:text-rose-500 text-[14px]"
      >
        ✕
      </button>
    </li>
  );
}
