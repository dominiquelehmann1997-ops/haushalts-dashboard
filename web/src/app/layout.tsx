import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body className="font-body text-ink antialiased">{children}</body>
    </html>
  );
}
