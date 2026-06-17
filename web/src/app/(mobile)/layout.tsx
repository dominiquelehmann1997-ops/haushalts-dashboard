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
