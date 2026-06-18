"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, CheckSquare, Utensils, ShoppingCart, Menu } from "lucide-react";

const TABS = [
  { href: "/mobile", label: "Heute", Icon: Sun, exact: true },
  { href: "/mobile/tasks", label: "Aufgaben", Icon: CheckSquare, exact: false },
  { href: "/mobile/meals", label: "Essen", Icon: Utensils, exact: false },
  { href: "/mobile/shopping", label: "Einkauf", Icon: ShoppingCart, exact: false },
  { href: "/mobile/more", label: "Mehr", Icon: Menu, exact: false },
] as const;

export function MobileNavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-cream-soft/95 dark:bg-[#26241F]/95 backdrop-blur border-t border-black/[0.06] dark:border-white/10 shadow-card flex justify-around py-2 pb-safe">
      {TABS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${
              active ? "text-dome-deep dark:text-dome" : "text-ink-faint hover:text-ink-soft dark:hover:text-cream/70"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[11px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
