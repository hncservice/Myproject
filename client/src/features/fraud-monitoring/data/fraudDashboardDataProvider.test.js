
import { describe, it, expect } from "vitest";

import {
  createFraudDashboardDataProvider,
} from "./fraudDashboardDataProvider";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

describe("HNC Fraud Dashboard Offline Data Provider", () => {
  it("remains disabled by default", () => {
    const provider = createFraudDashboardDataProvider();

    expect(provider.mode).toBe("disabled");
    expect(provider.sessions).toEqual([]);
  });

  it("does not process a report while disabled", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: false,
      report: { unsafe: true },
    });

    expect(provider.sessions).toEqual([]);
  });

  it("requires a report when explicitly enabled", () => {
    expect(() =>
      createFraudDashboardDataProvider({
        enabled: true,
      })
    ).toThrow("DASHBOARD_REPORT_REQUIRED");
  });

  it("accepts actual validated synthetic backend reports", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    expect(provider.mode).toBe("validated-sandbox");
    expect(provider.sessions).toHaveLength(2);
  });

  it("preserves separate integrity and behavior results", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    for (const session of provider.sessions) {
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

  it("rejects unsafe backend report data", () => {
    const tampered = structuredClone(backendReport);
    tampered.prizeAllocated = true;

    expect(() =>
      createFraudDashboardDataProvider({
        enabled: true,
        report: tampered,
      })
    ).toThrow();
  });

  it("returns immutable session data", () => {
    const provider = createFraudDashboardDataProvider({
      enabled: true,
      report: backendReport,
    });

    expect(Object.isFrozen(provider)).toBe(true);
    expect(Object.isFrozen(provider.sessions)).toBe(true);

    for (const session of provider.sessions) {
      expect(Object.isFrozen(session)).toBe(true);
      expect(Object.isFrozen(session.integrity)).toBe(true);
      expect(Object.isFrozen(session.behavior)).toBe(true);
    }
  });
});
