import { describe, expect, it } from "vitest";

import { parseClaudeResult } from "./claudeCli";

describe("parseClaudeResult", () => {
  it("gibt das Ergebnisfeld zurück", () => {
    const stdout = JSON.stringify({ type: "result", is_error: false, result: "Hallo" });
    expect(parseClaudeResult(stdout)).toBe("Hallo");
  });

  it("wirft bei is_error mit der Meldung der CLI", () => {
    const stdout = JSON.stringify({
      type: "result",
      is_error: true,
      api_error_status: 401,
      result: "OAuth access token has expired. Re-authenticate to continue.",
    });
    expect(() => parseClaudeResult(stdout)).toThrow(/401/);
    expect(() => parseClaudeResult(stdout)).toThrow(/expired/);
  });

  it("wirft bei unlesbarer Ausgabe", () => {
    expect(() => parseClaudeResult("kein json")).toThrow(/Ausgabeformat/);
  });
});
