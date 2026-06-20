"use client";

import { useState, useTransition } from "react";
import { syncCalendarAction } from "@/app/actions/calendar";
import { RefreshIcon, CheckIcon } from "@/components/icons";

type State = "idle" | "ok" | "error";

/**
 * Kleiner Sync-Button (Tablet-Topbar & Handy-PageHeader): synct den Google-
 * Kalender, verteilt neu, revalidiert. Zeigt Spinner während des Laufs, danach
 * kurz Haken (ok) bzw. Fehler-Titel.
 */
export function SyncButton({ className = "" }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>("idle");

  const onClick = () =>
    startTransition(async () => {
      const result = await syncCalendarAction();
      setState(result.ok ? "ok" : "error");
      setTimeout(() => setState("idle"), 2500);
    });

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label="Kalender synchronisieren"
      title={state === "error" ? "Sync fehlgeschlagen" : "Kalender synchronisieren"}
      className={`w-11 h-11 grid place-items-center rounded-full bg-white dark:bg-[#26241F] shadow-card text-ink-soft dark:text-cream/70 hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 ${state === "error" ? "text-red-500" : ""} ${className}`}
    >
      {state === "ok" ? <CheckIcon /> : <RefreshIcon className={pending ? "w-5 h-5 animate-spin" : "w-5 h-5"} />}
    </button>
  );
}
