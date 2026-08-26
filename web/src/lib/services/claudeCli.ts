// Gemeinsamer Wrapper um die `claude` CLI im Headless-Modus. Authentifiziert
// über CLAUDE_CODE_OAUTH_TOKEN aus web/.env gegen das Claude-Abo — kein
// API-Key, keine Kosten pro Aufruf.
//
// Der Prompt geht via **stdin** rein (nicht argv) — vermeidet Quoting-Probleme
// mit mehrzeiligen Prompts plattformübergreifend. Nur Flags stehen in argv,
// daher ist `shell:true` (Windows: `claude.cmd` auflösen) hier ungefährlich.
//
// NIEMALS `--bare` ergänzen: in diesem Modus liest die CLI bewusst keine
// OAuth-Credentials, nur ANTHROPIC_API_KEY — der Abo-Weg wäre tot.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export const DEFAULT_MODEL = "claude-sonnet-5";

export interface RunClaudeOptions {
  timeoutMs?: number;
  model?: string;
}

/**
 * Liest das `result`-Feld aus der `--output-format json`-Ausgabe.
 *
 * Wichtig: die CLI beendet sich mit Exit-Code 0, auch wenn der Aufruf
 * inhaltlich gescheitert ist (abgelaufener Token, Rate-Limit) — erkennbar nur
 * an `is_error`. Ohne diese Prüfung kommt ein leerer String durch und der
 * Fehler taucht erst drei Schichten später als "kein Rezept erkannt" auf.
 */
export function parseClaudeResult(stdout: string): string {
  let payload: { is_error?: boolean; api_error_status?: number | null; result?: unknown };
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error("claude CLI: unerwartetes Ausgabeformat");
  }
  const text = String(payload.result ?? "");
  if (payload.is_error) {
    const status = payload.api_error_status ? ` (HTTP ${payload.api_error_status})` : "";
    throw new Error(`claude CLI${status}: ${text || "unbekannter Fehler"}`);
  }
  return text;
}

/** Ruft die CLI headless auf. Wirft bei Timeout, Prozessfehler oder `is_error`. */
export function runClaude(prompt: string, opts: RunClaudeOptions = {}): Promise<string> {
  const { timeoutMs = 120_000, model = DEFAULT_MODEL } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "json", "--model", model],
      { cwd: tmpdir(), shell: process.platform === "win32" }, // tmp-cwd: kein Repo-Context
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI Timeout nach ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdin.on("error", () => {}); // EPIPE schlucken, falls Kind früh stirbt
    child.stdin.write(prompt);
    child.stdin.end();
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exit ${code}: ${err.slice(0, 500)}`));
      try {
        resolve(parseClaudeResult(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}
