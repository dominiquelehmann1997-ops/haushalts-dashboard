import { describe, expect, it } from "vitest";

import { googleEventsFixture } from "./fixture";
import { mapGoogleEvents } from "./google";

describe("mapGoogleEvents", () => {
  it("skips cancelled events", () => {
    const events = mapGoogleEvents(googleEventsFixture, "dome");
    expect(events.map((e) => e.externalId)).not.toContain("dome:evt-cancelled-004");
    expect(events).toHaveLength(3);
  });

  it("prefixes externalId with the calendarKey to stay unique across calendars", () => {
    const events = mapGoogleEvents(googleEventsFixture, "dome");
    expect(events[0].externalId).toBe("dome:evt-sport-001");
  });

  it("maps a timed event's start/end from start.dateTime/end.dateTime", () => {
    const [sport] = mapGoogleEvents(googleEventsFixture, "dome");

    expect(sport.title).toBe("Sport");
    expect(sport.start).toEqual(new Date("2026-06-07T18:30:00+02:00"));
    expect(sport.end).toEqual(new Date("2026-06-07T20:00:00+02:00"));
    expect(sport.place).toBe("Verein");
    expect(sport.kind).toBe("termin");
  });

  it("maps an all-day event's start/end from start.date/end.date as local-midnight dates", () => {
    const events = mapGoogleEvents(googleEventsFixture, "family");
    const birthday = events.find((e) => e.externalId === "family:evt-geburtstag-002");

    expect(birthday).toBeDefined();
    expect(birthday?.start).toEqual(new Date(2026, 5, 10));
    expect(birthday?.end).toEqual(new Date(2026, 5, 11));
    expect(birthday?.place).toBeNull();
  });

  it('classifies "U4-Untersuchung" as kind "baby-arzt" via the medical/baby heuristic', () => {
    const events = mapGoogleEvents(googleEventsFixture, "emely");
    const u4 = events.find((e) => e.externalId === "emely:evt-u4-003");

    expect(u4).toBeDefined();
    expect(u4?.kind).toBe("baby-arzt");
    expect(u4?.title).toBe("U4-Untersuchung");
    expect(u4?.place).toBe("Kinderarzt Dr. Müller");
  });

  it('derives personKey "dome"/"emely" from the calendarKey, and null for other calendars (e.g. family)', () => {
    expect(mapGoogleEvents(googleEventsFixture, "dome")[0].personKey).toBe("dome");
    expect(mapGoogleEvents(googleEventsFixture, "emely")[0].personKey).toBe("emely");

    const familyEvents = mapGoogleEvents(googleEventsFixture, "family");
    expect(familyEvents.every((e) => e.personKey === null)).toBe(true);
  });

  it("sets calendarKey on every mapped event", () => {
    const events = mapGoogleEvents(googleEventsFixture, "dome");
    expect(events.every((e) => e.calendarKey === "dome")).toBe(true);
  });
});
