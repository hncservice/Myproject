
import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createFraudReportSandboxAdapter,
} from "./fraudReportSandboxAdapter";

const SESSION_ID = "507f1f77bcf86cd799439011";

function validResponse() {
  return {
    campaignId: "hnc-sandbox",
    requested: 1,
    evaluated: 1,
    found: 1,
    missing: 0,

    reports: [
      {
        sessionId: SESSION_ID,
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

function createAdapter(transport, options = {}) {
  return createFraudReportSandboxAdapter({
    enabled: true,
    baseUrl: "http://127.0.0.1:8787",
    transport,
    ...options,
  });
}

describe("HNC Sandbox API Adapter Security", () => {
  it("is disabled by default", async () => {
    const transport = vi.fn();

    const adapter = createFraudReportSandboxAdapter({
      transport,
    });

    expect(adapter.enabled).toBe(false);

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
        adminToken: "test-token",
      })
    ).rejects.toThrow("SANDBOX_ADAPTER_DISABLED");

    expect(transport).not.toHaveBeenCalled();
  });

  it("requires an explicitly injected transport", () => {
    expect(() =>
      createFraudReportSandboxAdapter({
        enabled: true,
        baseUrl: "http://127.0.0.1:8787",
      })
    ).toThrow("SANDBOX_TRANSPORT_REQUIRED");
  });

  it("rejects production or remote URLs", () => {
    const transport = vi.fn();

    expect(() =>
      createAdapter(transport, {
        baseUrl: "https://api.hotncool.qa",
      })
    ).toThrow("UNTRUSTED_SANDBOX_ORIGIN");
  });

  it("rejects localhost URLs containing credentials", () => {
    const transport = vi.fn();

    expect(() =>
      createAdapter(transport, {
        baseUrl:
          "http://user:password@127.0.0.1:8787",
      })
    ).toThrow("UNTRUSTED_SANDBOX_ORIGIN");
  });

  it("rejects URLs containing unexpected paths", () => {
    const transport = vi.fn();

    expect(() =>
      createAdapter(transport, {
        baseUrl: "http://127.0.0.1:8787/admin",
      })
    ).toThrow("UNTRUSTED_SANDBOX_ORIGIN");
  });

  it("rejects malformed session IDs before transport", async () => {
    const transport = vi.fn();

    const adapter = createAdapter(transport);

    await expect(
      adapter.getReport({
        sessionIds: ["invalid"],
        adminToken: "test-token",
      })
    ).rejects.toThrow("INVALID_SESSION_ID");

    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects missing authentication tokens", async () => {
    const transport = vi.fn();

    const adapter = createAdapter(transport);

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
      })
    ).rejects.toThrow("INVALID_ADMIN_TOKEN");

    expect(transport).not.toHaveBeenCalled();
  });

  it("validates a mock sandbox response", async () => {
    const transport = vi.fn().mockResolvedValue(
      validResponse()
    );

    const adapter = createAdapter(transport);

    const result = await adapter.getReport({
      sessionIds: [SESSION_ID],
      adminToken: "synthetic-test-token",
    });

    expect(result.found).toBe(1);
    expect(result.reports[0].readOnly).toBe(true);
    expect(result.prizeAllocated).toBe(false);

    expect(transport).toHaveBeenCalledOnce();

    const request = transport.mock.calls[0][0];

    expect(request.url).toBe(
      "http://127.0.0.1:8787/sandbox/fraud-report"
    );

    expect(request.method).toBe("POST");
    expect(request.redirect).toBe("error");
    expect(request.credentials).toBe("omit");

    expect(JSON.parse(request.body)).toEqual({
      sessionIds: [SESSION_ID],
      limit: 1,
    });
  });

  it("rejects unsafe mock backend responses", async () => {
    const response = validResponse();

    response.reports[0].behaviorAffectsPrizeDecision =
      true;

    const transport = vi.fn().mockResolvedValue(
      response
    );

    const adapter = createAdapter(transport);

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
        adminToken: "synthetic-test-token",
      })
    ).rejects.toThrow(
      "UNSAFE_REPORT_DECISION_STATE"
    );
  });

  it("does not expose transport errors or tokens", async () => {
    const transport = vi.fn().mockRejectedValue(
      new Error(
        "Internal error: synthetic-test-token"
      )
    );

    const adapter = createAdapter(transport);

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
        adminToken: "synthetic-test-token",
      })
    ).rejects.toThrow("SANDBOX_REQUEST_FAILED");
  });

  it("rejects invalid timeout configurations", () => {
    const transport = vi.fn();

    expect(() =>
      createAdapter(transport, {
        timeoutMs: 0,
      })
    ).toThrow("INVALID_SANDBOX_TIMEOUT");

    expect(() =>
      createAdapter(transport, {
        timeoutMs: 20000,
      })
    ).toThrow("INVALID_SANDBOX_TIMEOUT");
  });

  it("times out a stalled mock transport", async () => {
    const transport = vi.fn(
      () => new Promise(() => {})
    );

    const adapter = createAdapter(transport, {
      timeoutMs: 20,
    });

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
        adminToken: "synthetic-test-token",
      })
    ).rejects.toThrow("SANDBOX_REQUEST_TIMEOUT");

    expect(transport).toHaveBeenCalledOnce();
  });
});
