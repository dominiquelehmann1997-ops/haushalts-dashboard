import { describe, expect, it } from "vitest";

import { correctedBusyEnd, isOvernightShift } from "./shifts";

describe("isOvernightShift", () => {
  it("recognizes the exact overnight shift titles, case- and whitespace-insensitive", () => {
    expect(isOvernightShift("Nacht")).toBe(true);
    expect(isOvernightShift("LN")).toBe(true);
    expect(isOvernightShift("nacht")).toBe(true);
    expect(isOvernightShift(" LN ")).toBe(true);
  });

  it("rejects other shifts and substring look-alikes (exact word match, not includes)", () => {
    expect(isOvernightShift("Früh")).toBe(false);
    expect(isOvernightShift("Spät")).toBe(false);
    expect(isOvernightShift("Nachtisch")).toBe(false);
    expect(isOvernightShift("Nachtschicht")).toBe(false);
    expect(isOvernightShift("")).toBe(false);
  });
});

describe("correctedBusyEnd", () => {
  it("returns 14:00 local on the day after the shift's start day", () => {
    const start = new Date(2026, 5, 8, 21, 0); // Mon 2026-06-08 21:00
    expect(correctedBusyEnd(start)).toEqual(new Date(2026, 5, 9, 14, 0));
  });

  it("rolls over month boundaries", () => {
    const start = new Date(2026, 5, 30, 22, 0); // 2026-06-30 22:00
    expect(correctedBusyEnd(start)).toEqual(new Date(2026, 6, 1, 14, 0));
  });
});
