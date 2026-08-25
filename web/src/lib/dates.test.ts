import { describe, expect, it } from "vitest";

import {
  formatWeekRange,
  mondayOf,
  weekOffsetLabel,
  weekOffsetOf,
  weekStartWithOffset,
} from "./dates";

// Mittwoch, 26.08.2026 — Montag dieser Woche ist der 24.08.2026.
const WEDNESDAY = new Date(2026, 7, 26, 14, 30);

describe("weekStartWithOffset", () => {
  it("liefert bei Offset 0 den Montag der Woche um `from`", () => {
    expect(weekStartWithOffset(0, WEDNESDAY)).toEqual(new Date(2026, 7, 24));
  });

  it("springt bei positivem Offset in kommende Wochen (Vorausplanung)", () => {
    expect(weekStartWithOffset(1, WEDNESDAY)).toEqual(new Date(2026, 7, 31));
    expect(weekStartWithOffset(2, WEDNESDAY)).toEqual(new Date(2026, 8, 7));
  });

  it("springt bei negativem Offset zurück", () => {
    expect(weekStartWithOffset(-1, WEDNESDAY)).toEqual(new Date(2026, 7, 17));
  });

  it("normalisiert auf lokale Mitternacht", () => {
    const start = weekStartWithOffset(1, WEDNESDAY);
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe("weekOffsetOf", () => {
  it("kehrt weekStartWithOffset um", () => {
    for (const offset of [-2, -1, 0, 1, 2, 5]) {
      expect(weekOffsetOf(weekStartWithOffset(offset, WEDNESDAY), WEDNESDAY)).toBe(offset);
    }
  });

  it("zählt ganze Wochen, egal welcher Wochentag übergeben wird", () => {
    // Sonntag der Folgewoche → immer noch Offset 1.
    expect(weekOffsetOf(new Date(2026, 8, 6, 23, 0), WEDNESDAY)).toBe(1);
  });

  it("überbrückt die DST-Umstellung ohne Rundungsfehler", () => {
    // Ende Oktober 2026 stellt Europa auf Winterzeit — eine Woche hat dort 169 h.
    const octoberWednesday = new Date(2026, 9, 21, 12, 0);
    const twoWeeksOn = weekStartWithOffset(2, octoberWednesday);
    expect(weekOffsetOf(twoWeeksOn, octoberWednesday)).toBe(2);
    expect(mondayOf(twoWeeksOn)).toEqual(twoWeeksOn);
  });
});

describe("formatWeekRange", () => {
  it("formatiert Montag–Sonntag der Woche um `date`", () => {
    expect(formatWeekRange(WEDNESDAY)).toBe("24.8. – 30.8.");
  });

  it("funktioniert über den Monatswechsel hinweg", () => {
    expect(formatWeekRange(new Date(2026, 7, 31))).toBe("31.8. – 6.9.");
  });
});

describe("weekOffsetLabel", () => {
  it("benennt die nahen Wochen aus", () => {
    expect(weekOffsetLabel(0)).toBe("Diese Woche");
    expect(weekOffsetLabel(1)).toBe("Nächste Woche");
    expect(weekOffsetLabel(-1)).toBe("Letzte Woche");
  });

  it("fällt für weitere Wochen auf eine Zählform zurück", () => {
    expect(weekOffsetLabel(2)).toBe("In 2 Wochen");
    expect(weekOffsetLabel(-3)).toBe("Vor 3 Wochen");
  });
});
