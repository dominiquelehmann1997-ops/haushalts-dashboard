import Link from "next/link";
import { Utensils, CheckSquare, FileText, Settings } from "lucide-react";

export function MobileNavBar() {
  return (
    <nav className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 text-white flex justify-around py-3 z-50 pb-safe">
      <Link href="/mobile/meals" className="flex flex-col items-center">
        <Utensils size={24} />
        <span className="text-xs mt-1">Essen</span>
      </Link>
      <Link href="/mobile/tasks" className="flex flex-col items-center">
        <CheckSquare size={24} />
        <span className="text-xs mt-1">Aufgaben</span>
      </Link>
      <Link href="/mobile/notes" className="flex flex-col items-center">
        <FileText size={24} />
        <span className="text-xs mt-1">Notizen</span>
      </Link>
      <Link href="/mobile/settings" className="flex flex-col items-center">
        <Settings size={24} />
        <span className="text-xs mt-1">Setup</span>
      </Link>
    </nav>
  );
}
