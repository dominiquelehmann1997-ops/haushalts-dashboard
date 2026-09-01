import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJob,
  failJob,
  finishJob,
  JOB_TTL_MS,
  readJob,
  __resetJobsForTest,
} from "./importJobs";

const RECIPE = { slug: "dal", name: "Dal" } as never;

describe("importJobs", () => {
  beforeEach(() => __resetJobsForTest());

  it("startet einen Job als pending", () => {
    expect(readJob(createJob())?.status).toBe("pending");
  });

  it("kennt unbekannte Ids nicht", () => {
    expect(readJob("gibtsnicht")).toBeNull();
  });

  it("haelt das Ergebnis fest", () => {
    const id = createJob();
    finishJob(id, RECIPE);
    const job = readJob(id);
    expect(job).toEqual({ status: "done", recipe: RECIPE });
  });

  it("haelt einen Fehler fest", () => {
    const id = createJob();
    failJob(id, "kaputt");
    expect(readJob(id)).toEqual({ status: "error", error: "kaputt" });
  });

  it("behaelt das Ergebnis auch nach mehrfachem Lesen", () => {
    const id = createJob();
    finishJob(id, RECIPE);
    readJob(id);
    expect(readJob(id)?.status).toBe("done");
  });

  it("vergisst Jobs nach Ablauf der TTL", () => {
    vi.useFakeTimers();
    try {
      const id = createJob();
      finishJob(id, RECIPE);
      vi.advanceTimersByTime(JOB_TTL_MS + 1);
      expect(readJob(id)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignoriert Ergebnisse fuer unbekannte Jobs", () => {
    expect(() => finishJob("gibtsnicht", RECIPE)).not.toThrow();
  });
});
