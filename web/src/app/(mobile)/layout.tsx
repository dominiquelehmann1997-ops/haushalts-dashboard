import type { Viewport } from "next";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { ServiceWorkerRegister } from "@/app/sw-register";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../globals.css";

// viewport-fit=cover lets the layout extend under the system bars so
// `env(safe-area-inset-*)` becomes non-zero — the bottom nav uses it to lift
// its tap targets above the Android gesture/navigation bar in standalone PWA.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ec",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Mobile-specific PWA manifest: start_url/scope "/mobile" so the
            installed app opens the phone UI (incl. bottom nav), not the
            tablet root "/". Tablet keeps its own /manifest.webmanifest. */}
        <link rel="manifest" href="/manifest-mobile.webmanifest" crossOrigin="use-credentials" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Handy" />
        {/* Vor dem ersten Paint: gespeicherte Design-Wahl (hell/dunkel/auto)
            anwenden. "auto" folgt der OS-Einstellung. Verhindert Flackern und
            respektiert den manuellen Schalter aus den Einstellungen. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
