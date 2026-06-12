import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public", "manifest.webmanifest"), "utf-8"),
  );

  it("is installable as a standalone app", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it("declares 192 and 512 icon sizes", () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("declares a maskable icon", () => {
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? "");
    expect(purposes.join(" ")).toContain("maskable");
  });
});
