
import { describe, it, expect, vi } from "vitest";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

import {
  createFraudDashboardDataProvider,
} from "./fraudDashboardDataProvider";

describe("HNC Dashboard Offline Integration", () => {
  it("remains disabled by default with an actual backend contract", () => {
    const provider = createFraudDashboardDataProvider({
      report: backendReport,
    });

    expect(provider.mode).toBe("disabled");
    expect(provider.sessions).toHaveLength(0);
  });

  it("transforms the actual synthetic report into dashboard sessions", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    expect(provider.mode).toBe("validated-sandbox");
    expect(provider.sessions).toHaveLength(2);

    for (const session of provider.sessions) {
      expect(session.sessionId).toMatch(/^[a-f0-9]{24}$/i);
      expect(session.readOnly).toBe(true);
    }
  });

  it("keeps Integrity V2 separate from Behavioral Signals V1", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    for (const session of provider.sessions) {
      expect(session.integrity.assessmentVersion).toBe(2);
      expect(session.behavior.behaviorVersion).toBe(1);

      expect(session.preliminaryReviewRequired).toBe(
        session.integrity.reviewRequired
      );

      expect(session.advisoryReviewSuggested).toBe(
        session.behavior.reviewSuggested
      );

      expect(session.behaviorAffectsPrizeDecision).toBe(false);
      expect(session.behavior.enforcementAllowed).toBe(false);
    }
  });

  it("rejects unexpected sensitive report fields", () => {
    const tampered = structuredClone(backendReport);

    tampered.reports[0].sessionTokenHash =
      "synthetic-forbidden-value";

    expect(() =>
      createFraudDashboardDataProvider({
        enabled: true,
        report: tampered,
      })
    ).toThrow();
  });

  it("rejects modified prize decisions", () => {
    const tampered = structuredClone(backendReport);

    tampered.decisionModified = true;

    expect(() =>
      createFraudDashboardDataProvider({
        enabled: true,
        report: tampered,
      })
    ).toThrow();
  });

  it("does not mutate the source backend report", () => {
    const original = JSON.stringify(backendReport);

    createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    expect(JSON.stringify(backendReport)).toBe(original);
  });

  it("does not perform HTTP requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      createFraudDashboardDataProvider({
        enabled: true,
        report: backendReport,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
