import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { ServiceWorkerRegister } from "@/app/sw-register";
import "../globals.css";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Mobile-specific PWA manifest: start_url/scope "/mobile" so the
            installed app opens the phone UI (incl. bottom nav), not the
            tablet root "/". Tablet keeps its own /manifest.webmanifest. */}
        <link rel="manifest" href="/manifest-mobile.webmanifest" crossOrigin="use-credentials" />
        <meta name="theme-color" content="#f7f3ec" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Handy" />
        {/* Before-paint: apply .dark when OS prefers dark — mobile only, tablet uses its own manual toggle */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="bg-cream text-ink dark:bg-[#1b1a18] dark:text-cream min-h-[100svh] flex flex-col font-body">
        {/* Scroll container pads its own bottom so the last items clear the
            fixed bottom nav (+ iOS safe area). Padding on <body> would not,
            since the scroll happens inside <main>. */}
        <ServiceWorkerRegister />
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] rise">
          {children}
        </main>
        <MobileNavBar />
      </body>
    </html>
  );
}
