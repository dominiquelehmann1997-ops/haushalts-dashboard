This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Rezepte-Vault

Rezepte werden in einem Obsidian-Vault als Markdown gepflegt (Vault = Wahrheit,
DB = Cache). Das Dashboard liest die lokal per Obsidian Sync gesyncte Kopie.

Setze `RECIPE_VAULT_PATH` in `web/.env` auf den Rezepte-Ordner, z.B.:

```
RECIPE_VAULT_PATH="C:/Users/<user>/Obsidian/Haushalt/Rezepte"
```

Vorlage: `docs/recipe-vault-template.md` als `_template.md` in den Ordner kopieren.
Einlesen über den Button „Rezepte einlesen" im Dashboard.

### Gewichtete Essensplan-Auswahl

Das Frontmatter-`rating` steuert, wie oft ein Rezept im Wochenplan landet:
`favorit` ≈ 3×, `ok` 1×, `selten` ≈ 0,3× Wahrscheinlichkeit — innerhalb der
harten Dienstplan-Constraints. Zusätzlich werden Gerichte gedämpft, die in den
letzten ~14 Tagen schon im aktiven Plan standen (nie ganz ausgeschlossen).
Ohne Bewertungen/Historie verhält sich der Planer wie vorher (Fallback).

### Haltbarkeits-Korrektur

Stuft die Heuristik eine Zutat falsch ein (z.B. Kokosmilch als „frisch"), lässt
sich das direkt am Einkaufs-Item umschalten — die Korrektur wird gemerkt und
gilt für jedes künftige Auftauchen der Zutat. Reihenfolge: explizite
`freshness`-Angabe im Rezept-Frontmatter → gemerkte Korrektur → Keyword-Heuristik.
