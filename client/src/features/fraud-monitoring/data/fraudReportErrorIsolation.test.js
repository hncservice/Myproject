
import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createFraudReportSandboxAdapter,
} from "./fraudReportSandboxAdapter";

const ID = "507f1f77bcf86cd799439011";

function makeAdapter(transport, timeoutMs = 1000) {
  return createFraudReportSandboxAdapter({
    enabled: true,
    baseUrl: "http://127.0.0.1:8787",
    transport,
    timeoutMs,
  });
}

function request() {
  return {
    sessionIds: [ID],
    adminToken: "synthetic-test-token",
  };
}

function validResponse() {
  return {
    campaignId: "hnc-sandbox",
    requested: 1,
    evaluated: 1,
    found: 1,
    missing: 0,

    reports: [
      {
        sessionId: ID,
        campaignId: "hnc-sandbox",
        gameId: "monkey",
        status: "completed",
        outcome: "qualified",
        score: 7,
        startedAt: "2026-10-22T10:00:00Z",
        completedAt: "2026-10-22T10:00:20Z",

        integrity: {
          assessmentVersion: 2,
          reviewRequired: false,
          riskReasons: [],
        },

        behavior: {
          behaviorVersion: 1,
          reviewSuggested: false,
          signals: [],
          enforcementAllowed: false,
        },

        preliminaryReviewRequired: false,
        behaviorAffectsPrizeDecision: false,
        advisoryReviewSuggested: false,
        readOnly: true,
      },
    ],

    notFound: [],
    reportType: "observational",
    databaseModified: false,
    prizeAllocated: false,
    decisionModified: false,
  };
}

describe("HNC Transport Error Origin Isolation", () => {
  it("sanitizes forged validator errors from transport", async () => {
    const transport = vi.fn().mockRejectedValue(
      new Error("INVALID_REPORT_SESSION")
    );

    const adapter = makeAdapter(transport);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow("SANDBOX_REQUEST_FAILED");
  });

  it("sanitizes forged unsafe-decision errors", async () => {
    const transport = vi.fn().mockRejectedValue(
      new Error("UNSAFE_REPORT_DECISION_STATE")
    );

    const adapter = makeAdapter(transport);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow("SANDBOX_REQUEST_FAILED");
  });

  it("preserves actual response-validator failures", async () => {
    const response = validResponse();
    response.reports[0].qrToken = "unexpected";

    const adapter = makeAdapter(
      vi.fn().mockResolvedValue(response)
    );

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow("INVALID_REPORT_SESSION");
  });

  it("does not return a late response after timeout", async () => {
    let releaseTransport;

    const transport = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseTransport = resolve;
        })
    );

    const adapter = makeAdapter(transport, 20);

    const pending = adapter.getReport(request());

    await expect(pending).rejects.toThrow(
      "SANDBOX_REQUEST_TIMEOUT"
    );

    expect(transport).toHaveBeenCalledOnce();

    // The transport resolves after the adapter
    // has already rejected the request.
    releaseTransport(validResponse());

    // The original request must remain rejected.
    await expect(pending).rejects.toThrow(
      "SANDBOX_REQUEST_TIMEOUT"
    );
  });

  it("does not expose token text in transport failures", async () => {
    const transport = vi.fn().mockRejectedValue(
      new Error(
        "Authorization failure: synthetic-test-token"
      )
    );

    const adapter = makeAdapter(transport);

    try {
      await adapter.getReport(request());

      throw new Error("EXPECTED_REJECTION");
    } catch (error) {
      expect(error.message).toBe(
        "SANDBOX_REQUEST_FAILED"
      );

      expect(error.message).not.toContain(
        "synthetic-test-token"
      );
    }
  });

  it("does not call transport when disabled", async () => {
    const transport = vi.fn();

    const adapter = createFraudReportSandboxAdapter({
      transport,
    });

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow("SANDBOX_ADAPTER_DISABLED");

    expect(transport).not.toHaveBeenCalled();
  });
});
