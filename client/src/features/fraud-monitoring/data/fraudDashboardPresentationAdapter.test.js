
import { describe, it, expect, vi } from "vitest";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

import {
  createFraudDashboardPresentationAdapter,
} from "./fraudDashboardPresentationAdapter";

import { calculateFraudDashboardMetrics } from "./fraudDashboardFilters";
import { createFraudDashboardViewModel } from "./fraudDashboardViewModel";

describe("HNC Dashboard Presentation Adapter", () => {
  it("matches shared metrics for the full validated session collection", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });

    expect(result.metrics).toEqual(calculateFraudDashboardMetrics(result.sessions));
    expect(result.metrics).toEqual({ total: 2, integrity: 0, behavioral: 1, normal: 1 });
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });

  it("counts overlapping integrity and behavioral findings independently", () => {
    const overlappingReport = {
      ...backendReport,
      reports: backendReport.reports.map((session, index) => index === 1 ? {
        ...session,
        integrity: {
          ...session.integrity,
          reviewRequired: true,
          riskReasons: ["SYNTHETIC_INTEGRITY_WARNING"],
        },
        preliminaryReviewRequired: true,
      } : session),
    };
    const before = JSON.stringify(overlappingReport);
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: overlappingReport,
    });

    expect(result.metrics).toEqual({ total: 2, integrity: 1, behavioral: 1, normal: 1 });
    expect(result.metrics).toEqual(calculateFraudDashboardMetrics(result.sessions));
    const overlapping = result.sessions[1];
    expect(overlapping.integrity.assessmentVersion).toBe(2);
    expect(overlapping.behavior.behaviorVersion).toBe(1);
    expect(overlapping.integrity.reviewRequired).toBe(true);
    expect(overlapping.behavior.reviewSuggested).toBe(true);
    expect(overlapping.behavior.enforcementAllowed).toBe(false);
    expect(overlapping.behaviorAffectsPrizeDecision).toBe(false);
    expect(JSON.stringify(overlappingReport)).toBe(before);
  });

  it("keeps full presentation metrics separate from filtered view-model metrics", () => {
    const presentation = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });
    const view = createFraudDashboardViewModel({
      enabled: true,
      report: backendReport,
      reviewFilter: "normal",
    });

    expect(presentation.sessions).toHaveLength(2);
    expect(view.sessions).toHaveLength(1);
    expect(presentation.metrics).toEqual({ total: 2, integrity: 0, behavioral: 1, normal: 1 });
    expect(view.metrics).toEqual({ total: 1, integrity: 0, behavioral: 0, normal: 1 });
    expect(view.metrics).toEqual(calculateFraudDashboardMetrics(view.sessions));
    expect(Object.isFrozen(view.metrics)).toBe(true);
  });

  it("remains disabled by default", () => {
    const result = createFraudDashboardPresentationAdapter();

    expect(result.mode).toBe("disabled");
    expect(result.sessions).toEqual([]);
    expect(result.metrics).toEqual({
      total: 0,
      integrity: 0,
      behavioral: 0,
      normal: 0,
    });
  });

  it("does not validate or process reports when disabled", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: false,
      report: { unsafe: true },
    });

    expect(result.sessions).toHaveLength(0);
  });

  it("accepts the actual synthetic backend contract", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });

    expect(result.mode).toBe("validated-sandbox");
    expect(result.sessions).toHaveLength(2);
    expect(result.metrics.total).toBe(2);
  });

  it("calculates dashboard metrics correctly", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });

    const sessions = result.sessions;

    expect(result.metrics.integrity).toBe(
      sessions.filter(
        (session) => session.integrity.reviewRequired
      ).length
    );

    expect(result.metrics.behavioral).toBe(
      sessions.filter(
        (session) => session.behavior.reviewSuggested
      ).length
    );

    expect(result.metrics.normal).toBe(
      sessions.filter(
        (session) =>
          !session.integrity.reviewRequired &&
          !session.behavior.reviewSuggested
      ).length
    );
  });

  it("preserves separation between integrity and behavior", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });

    for (const session of result.sessions) {
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

  it("rejects unsafe prize modifications", () => {
    const tampered = structuredClone(backendReport);
    tampered.decisionModified = true;

    expect(() =>
      createFraudDashboardPresentationAdapter({
        enabled: true,
        report: tampered,
      })
    ).toThrow();
  });

  it("returns immutable presentation data", () => {
    const result = createFraudDashboardPresentationAdapter({
      enabled: true,
      report: backendReport,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sessions)).toBe(true);
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });

  it("does not perform HTTP requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      createFraudDashboardPresentationAdapter({
        enabled: true,
        report: backendReport,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
