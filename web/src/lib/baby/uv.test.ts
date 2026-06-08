import { describe, expect, it } from "vitest";

import { uvAdvice } from "./uv";

describe("uvAdvice", () => {
  it("index 1 → niedrig, relaxed advice", () => {
    const a = uvAdvice(1, "0-3m");
    expect(a.level).toBe("niedrig");
    expect(a.index).toBe(1);
    expect(a.advice).toMatch(/kein|unbedenklich|normal/i);
  });

  it("index 4 + 0-3m → mäßig with a clear shade/no-cream-for-infants note", () => {
    const a = uvAdvice(4, "0-3m");
    expect(a.level).toBe("mäßig");
    expect(a.advice).toMatch(/Schatten/);
    expect(a.advice).toMatch(/Creme|Kleidung/);
  });

  it("index 8 → sehr hoch with a strong warning", () => {
    const a = uvAdvice(8, "0-3m");
    expect(a.level).toBe("sehr hoch");
    expect(a.advice).toMatch(/meide|vermeide|direkte Sonne/i);
  });

  it("index 11+ → extrem", () => {
    expect(uvAdvice(11, "4m+").level).toBe("extrem");
  });

  it("maps the standard WMO/WHO bands", () => {
    expect(uvAdvice(2, "4m+").level).toBe("niedrig");
    expect(uvAdvice(5, "4m+").level).toBe("mäßig");
    expect(uvAdvice(6, "4m+").level).toBe("hoch");
    expect(uvAdvice(7, "4m+").level).toBe("hoch");
    expect(uvAdvice(10, "4m+").level).toBe("sehr hoch");
  });

  it("an older baby at a moderate index gets a lighter note than a 0-3m baby", () => {
    expect(uvAdvice(4, "4m+").advice).not.toEqual(uvAdvice(4, "0-3m").advice);
  });
});
