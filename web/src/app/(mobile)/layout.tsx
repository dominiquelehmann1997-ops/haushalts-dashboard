import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import "../globals.css";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Before-paint: apply .dark when OS prefers dark — mobile only, tablet uses its own manual toggle */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="bg-cream text-ink dark:bg-[#1b1a18] dark:text-cream min-h-[100svh] flex flex-col pb-20 font-body">
        <main className="flex-1 overflow-y-auto p-4 rise">{children}</main>
        <MobileNavBar />
      </body>
    </html>
  );
}
