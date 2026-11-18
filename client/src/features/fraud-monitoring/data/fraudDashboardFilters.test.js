
import { describe, it, expect } from "vitest";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

import {
  createFraudDashboardPresentationAdapter,
} from "./fraudDashboardPresentationAdapter";

import {
  filterFraudDashboardSessions,
  calculateFraudDashboardMetrics,
} from "./fraudDashboardFilters";

const { sessions } = createFraudDashboardPresentationAdapter({
  enabled: true,
  report: backendReport,
});

describe("HNC Dashboard Reusable Filters", () => {
    
it("rejects unsupported game filters", () => {
  expect(() =>
    filterFraudDashboardSessions(sessions, {
      gameFilter: "unknown-game",
    })
  ).toThrow("INVALID_DASHBOARD_FILTER");
});

it("rejects unsupported review filters", () => {
  expect(() =>
    filterFraudDashboardSessions(sessions, {
      reviewFilter: "unknown-review",
    })
  ).toThrow("INVALID_DASHBOARD_FILTER");
});

it("rejects excessively long search input", () => {
  expect(() =>
    filterFraudDashboardSessions(sessions, {
      search: "x".repeat(201),
    })
  ).toThrow("INVALID_DASHBOARD_FILTER");
});

  it("returns all validated sessions by default", () => {
    const result = filterFraudDashboardSessions(sessions);

    expect(result).toHaveLength(2);
  });

  it("filters Monkey gameplay sessions", () => {
    const result = filterFraudDashboardSessions(sessions, {
      gameFilter: "monkey",
    });

    expect(result.every((s) => s.gameId === "monkey"))
      .toBe(true);
  });

  it("filters integrity review sessions", () => {
    const result = filterFraudDashboardSessions(sessions, {
      reviewFilter: "integrity",
    });

    expect(
      result.every((s) => s.integrity.reviewRequired)
    ).toBe(true);
  });

  it("filters behavioral warnings separately", () => {
    const result = filterFraudDashboardSessions(sessions, {
      reviewFilter: "behavior",
    });

    expect(
      result.every((s) => s.behavior.reviewSuggested)
    ).toBe(true);
  });

  it("filters normal sessions correctly", () => {
    const result = filterFraudDashboardSessions(sessions, {
      reviewFilter: "normal",
    });

    expect(
      result.every(
        (s) =>
          !s.integrity.reviewRequired &&
          !s.behavior.reviewSuggested
      )
    ).toBe(true);
  });

  it("supports case-insensitive session search", () => {
    const target = sessions[0].sessionId;

    const result = filterFraudDashboardSessions(sessions, {
      search: target.toUpperCase(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe(target);
  });

  it("calculates metrics consistently", () => {
    const metrics = calculateFraudDashboardMetrics(sessions);

    expect(metrics.total).toBe(2);

    expect(metrics.integrity).toBe(
      sessions.filter((s) => s.integrity.reviewRequired)
        .length
    );

    expect(metrics.behavioral).toBe(
      sessions.filter((s) => s.behavior.reviewSuggested)
        .length
    );
  });

  it("rejects invalid session collections", () => {
    expect(() =>
      filterFraudDashboardSessions(null)
    ).toThrow("INVALID_DASHBOARD_SESSIONS");

    expect(() =>
      calculateFraudDashboardMetrics(null)
    ).toThrow("INVALID_DASHBOARD_SESSIONS");
  });

  it("returns immutable results", () => {
    const filtered = filterFraudDashboardSessions(sessions);

    const metrics = calculateFraudDashboardMetrics(filtered);

    expect(Object.isFrozen(filtered)).toBe(true);
    expect(Object.isFrozen(metrics)).toBe(true);
  });
});
