
import { describe, it, expect } from "vitest";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

import {
  createFraudDashboardViewModel,
} from "./fraudDashboardViewModel";

function makeView(overrides = {}) {
  return createFraudDashboardViewModel({
    enabled: true,
    report: backendReport,
    ...overrides,
  });
}

describe("HNC Fraud Dashboard Offline View Model", () => {

    it("rejects excessively long selections", () => {
  expect(() =>
    makeView({
      selectedId: "x".repeat(300),
    })
  ).toThrow("INVALID_DASHBOARD_SELECTION");
});

it("rejects mock-format identifiers in validated mode", () => {
  expect(() =>
    makeView({
      selectedId: "SANDBOX-M001",
    })
  ).toThrow("INVALID_DASHBOARD_SELECTION");
});

it("ignores untrusted selections when disabled", () => {
  const result = createFraudDashboardViewModel({
    enabled: false,
    report: { unsafe: true },
    selectedId: { invalid: true },
  });

  expect(result.mode).toBe("disabled");
  expect(result.selectedReport).toBeNull();
  expect(result.sessions).toHaveLength(0);
});
  it("remains disabled by default", () => {
    const result = createFraudDashboardViewModel();

    expect(result.mode).toBe("disabled");
    expect(result.sessions).toHaveLength(0);
    expect(result.metrics.total).toBe(0);
    expect(result.selectedReport).toBeNull();
  });

  it("accepts the actual synthetic backend report", () => {
    const result = makeView();

    expect(result.mode).toBe("validated-sandbox");
    expect(result.sessions).toHaveLength(2);
    expect(result.metrics.total).toBe(2);
  });

  it("filters sessions by game", () => {
    const result = makeView({
      gameFilter: "monkey",
    });

    expect(
      result.sessions.every(
        (session) => session.gameId === "monkey"
      )
    ).toBe(true);
  });

  it("filters integrity and behavior separately", () => {
    const integrity = makeView({
      reviewFilter: "integrity",
    });

    const behavior = makeView({
      reviewFilter: "behavior",
    });

    expect(
      integrity.sessions.every(
        (session) => session.integrity.reviewRequired
      )
    ).toBe(true);

    expect(
      behavior.sessions.every(
        (session) => session.behavior.reviewSuggested
      )
    ).toBe(true);
  });

  it("searches sessions without changing the source", () => {
    const original = JSON.stringify(backendReport);
    const sessionId = backendReport.reports[0].sessionId;

    const result = makeView({
      search: sessionId.toUpperCase(),
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].sessionId).toBe(sessionId);
    expect(JSON.stringify(backendReport)).toBe(original);
  });

  it("recalculates metrics after filtering", () => {
    const result = makeView({
      search: backendReport.reports[0].sessionId,
    });

    expect(result.metrics.total).toBe(1);

    expect(result.metrics.integrity).toBe(
      result.sessions.filter(
        (session) => session.integrity.reviewRequired
      ).length
    );
  });

  it("selects a visible session", () => {
    const sessionId = backendReport.reports[0].sessionId;

    const result = makeView({
      selectedId: sessionId,
    });

    expect(result.selectedReport?.sessionId).toBe(sessionId);
  });

  it("hides selected details when a session is filtered out", () => {
    const sessionId = backendReport.reports[0].sessionId;

    const result = makeView({
      selectedId: sessionId,
      search: "NO-MATCHING-SESSION",
    });

    expect(result.selectedReport).toBeNull();
  });

  it("rejects invalid selections", () => {
    expect(() =>
      makeView({
        selectedId: { invalid: true },
      })
    ).toThrow("INVALID_DASHBOARD_SELECTION");
  });

  it("rejects unsafe report data", () => {
    const tampered = structuredClone(backendReport);
    tampered.prizeAllocated = true;

    expect(() =>
      makeView({
        report: tampered,
      })
    ).toThrow();
  });

  it("returns immutable view data", () => {
    const result = makeView();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sessions)).toBe(true);
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });
});
