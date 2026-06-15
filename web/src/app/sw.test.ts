import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("service worker", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf-8");

  it("registers install, activate and fetch handlers", () => {
    expect(sw).toContain('addEventListener("install"');
    expect(sw).toContain('addEventListener("activate"');
    expect(sw).toContain('addEventListener("fetch"');
  });

  it("precaches an offline fallback that exists", () => {
    expect(sw).toContain("/offline.html");
    expect(existsSync(join(process.cwd(), "public", "offline.html"))).toBe(true);
  });

  it("does not implement push notifications (out of scope)", () => {
    expect(sw).not.toContain('addEventListener("push"');
  });
});
