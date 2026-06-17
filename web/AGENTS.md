<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🛡️ Safe Development Workflow (Laufender Betrieb vs. Entwicklung)

Um den laufenden Betrieb des Dashboards (Handysteuerung, Aufgaben, Essensplan etc.) nicht zu beeinträchtigen und Datenverlust zu vermeiden, MUSS für jede zukünftige Änderung diese Regel strikt befolgt werden:

1. **Isolierte Entwicklung**: Nutze für neue Features IMMER die Superpower-Skill `using-git-worktrees` (z.B. `git worktree add`). Entwickle **niemals** direkt im Hauptverzeichnis des laufenden Betriebs (`Dashboard/web` auf dem `main` Branch).
2. **Datenbank-Trennung**: 
   - Der laufende Betrieb nutzt seine eigene Produktionsdatenbank (z.B. `prod.db` definiert in `.env.production` oder `DATABASE_URL`).
   - In der isolierten Entwicklungsumgebung (Worktree) arbeiten wir mit einer separaten `.env` Datei und nutzen eine isolierte `dev.db`.
   - **Niemals** darf eine Migration (`prisma db push` oder `prisma migrate`) in der Entwicklungsumgebung die Produktionsdatenbank berühren.
3. **Deployment**: Erst wenn im Worktree alles fertig und getestet ist, wird der Code in den `main` Branch gemerged und der laufende Betrieb (mit der unberührten Produktionsdatenbank) neu gestartet.
