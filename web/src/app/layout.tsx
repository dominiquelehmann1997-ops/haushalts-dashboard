import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haushalts-Cockpit · Heute",
  description:
    "Ruhiges Familien-Dashboard — Aufgaben, Termine, Essensplan und Einkauf an einem Ort. Mental Load reduzieren.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cockpit", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body className="font-body text-ink antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
