"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, CheckSquare, Repeat, Utensils, StickyNote, Settings } from "lucide-react";

const TABS = [
  { href: "/mobile", label: "Heute", Icon: Sun, exact: true },
  { href: "/mobile/tasks", label: "Aufgaben", Icon: CheckSquare, exact: false },
  { href: "/mobile/routines", label: "Routinen", Icon: Repeat, exact: false },
  { href: "/mobile/meals", label: "Essen", Icon: Utensils, exact: false },
  { href: "/mobile/notes", label: "Notizen", Icon: StickyNote, exact: false },
  { href: "/mobile/settings", label: "Einstellungen", Icon: Settings, exact: false },
] as const;

export function MobileNavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-cream-soft/95 dark:bg-[#26241F]/95 backdrop-blur border-t border-black/[0.06] dark:border-white/10 shadow-card flex justify-around pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-colors ${
              active ? "text-dome-deep dark:text-dome" : "text-ink-faint hover:text-ink-soft dark:hover:text-cream/70"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[10.5px] font-semibold whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
