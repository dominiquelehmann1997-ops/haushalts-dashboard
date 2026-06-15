import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public", "manifest.webmanifest"), "utf-8"),
  );
  const icons = manifest.icons as Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;

  it("is installable as a standalone app", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it("declares 192 and 512 PNG icons", () => {
    const png192 = icons.find(
      (i) => i.sizes === "192x192" && i.type === "image/png",
    );
    const png512 = icons.find(
      (i) => i.sizes === "512x512" && i.type === "image/png",
    );
    expect(png192).toBeDefined();
    expect(png512).toBeDefined();
  });

  it("declares a maskable PNG icon", () => {
    const maskable = icons.find(
      (i) => (i.purpose ?? "").includes("maskable") && i.type === "image/png",
    );
    expect(maskable).toBeDefined();
  });

  it("ships the referenced icon files", () => {
    for (const icon of icons) {
      expect(
        existsSync(join(process.cwd(), "public", icon.src.replace(/^\//, ""))),
        `missing icon file: ${icon.src}`,
      ).toBe(true);
    }
    expect(
      existsSync(join(process.cwd(), "public", "apple-icon-180.png")),
    ).toBe(true);
  });
});
