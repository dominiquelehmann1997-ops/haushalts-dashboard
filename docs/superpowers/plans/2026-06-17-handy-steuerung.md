# Handy-Steuerungsoberfläche Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) oder superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementieren einer isolierten Mobile-Steuerungsoberfläche (`/mobile`) mit einer Bottom-Navigation-Bar für Essen, Aufgaben, Notizen und Einstellungen.

**Architecture:** Wir nutzen eine Next.js Route Group `(mobile)`, um ein separates Root-Layout (`app/(mobile)/layout.tsx`) zu definieren, das nicht vom Tablet-Layout (`app/layout.tsx`) erbt. Das Layout bindet eine globale `MobileNavBar` ein, die per Sticky-Position am unteren Bildschirmrand fixiert ist.

**Tech Stack:** Next.js 16.2.7 App Router, React (Server Components), TailwindCSS, Lucide-Icons.

---

### Task 1: Route Group & Mobile Layout Setup

**Files:**
- Create: `web/src/app/(mobile)/layout.tsx`
- Create: `web/src/components/mobile/MobileNavBar.tsx`

- [ ] **Step 1: Write `MobileNavBar` Component**
Implementiere die Navigation mit 4 Reitern (Essen, Aufgaben, Notizen, Einstellungen).
```tsx
import Link from "next/link";
import { Utensils, CheckSquare, FileText, Settings } from "lucide-react";

export function MobileNavBar() {
  return (
    <nav className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 text-white flex justify-around py-3 z-50 pb-safe">
      <Link href="/mobile/meals" className="flex flex-col items-center"><Utensils size={24} /><span className="text-xs mt-1">Essen</span></Link>
      <Link href="/mobile/tasks" className="flex flex-col items-center"><CheckSquare size={24} /><span className="text-xs mt-1">Aufgaben</span></Link>
      <Link href="/mobile/notes" className="flex flex-col items-center"><FileText size={24} /><span className="text-xs mt-1">Notizen</span></Link>
      <Link href="/mobile/settings" className="flex flex-col items-center"><Settings size={24} /><span className="text-xs mt-1">Setup</span></Link>
    </nav>
  );
}
```

- [ ] **Step 2: Create Mobile Layout**
Erstelle das Layout für alle `/mobile` Routen.
```tsx
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import "../globals.css";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col pb-20">
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
        <MobileNavBar />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add web/src/app/\(mobile\)/layout.tsx web/src/components/mobile/MobileNavBar.tsx
git commit -m "feat(mobile): add isolated mobile layout and bottom navigation"
```

### Task 2: Mobile Root Redirect & Meals Page

**Files:**
- Create: `web/src/app/(mobile)/mobile/page.tsx`
- Create: `web/src/app/(mobile)/mobile/meals/page.tsx`

- [ ] **Step 1: Add `/mobile` redirect**
```tsx
import { redirect } from "next/navigation";

export default function MobileRoot() {
  redirect("/mobile/meals");
}
```

- [ ] **Step 2: Create Mobile Meals Page**
```tsx
import { MealDraftPanel } from "@/components/MealDraftPanel";

export default function MobileMealsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Essensplan</h1>
      {/* Wir binden den bestehenden DraftPanel für die Steuerung ein */}
      <MealDraftPanel />
    </div>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add web/src/app/\(mobile\)/mobile/page.tsx web/src/app/\(mobile\)/mobile/meals/page.tsx
git commit -m "feat(mobile): add meals interface and root redirect"
```

### Task 3: Placeholder Pages for Tasks, Notes & Settings

**Files:**
- Create: `web/src/app/(mobile)/mobile/tasks/page.tsx`
- Create: `web/src/app/(mobile)/mobile/notes/page.tsx`
- Create: `web/src/app/(mobile)/mobile/settings/page.tsx`

- [ ] **Step 1: Create Placeholder Pages**
Erstelle simple Platzhalter für die verbleibenden Navigationspunkte (analog zu diesem Beispiel):
```tsx
export default function MobileTasksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Aufgaben</h1>
      <p className="text-slate-400">Hier folgen in den nächsten Schritten die verteilten Aufgaben.</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add web/src/app/\(mobile\)/mobile/tasks/page.tsx web/src/app/\(mobile\)/mobile/notes/page.tsx web/src/app/\(mobile\)/mobile/settings/page.tsx
git commit -m "feat(mobile): add placeholder pages for tasks, notes, settings"
```
