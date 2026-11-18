
import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createFraudReportSandboxAdapter,
} from "./fraudReportSandboxAdapter";

import {
  createSandboxFraudHttpTransport,
} from "./fraudReportSandboxTransport";

// =====================================================
// STEP 15R.22N
// HNC FRAUD REPORT — COMPOSED INTEGRATION TESTS
//
// Synthetic data only.
// No real HTTP requests.
// No MongoDB connection.
// No prize allocation.
// =====================================================

const SESSION_ID = "507f1f77bcf86cd799439011";

const BASE_URL = "http://127.0.0.1:8787";

function makeReport({
  integrityWarning = false,
  behaviorWarning = false,
} = {}) {
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
          reviewRequired: integrityWarning,
          riskReasons: integrityWarning
            ? ["MONKEY_SCORE_MISMATCH"]
            : [],
        },

        behavior: {
          behaviorVersion: 1,
          reviewSuggested: behaviorWarning,
          signals: behaviorWarning
            ? ["HIGHLY_REGULAR_TAP_CADENCE"]
            : [],
          enforcementAllowed: false,
        },

        preliminaryReviewRequired: integrityWarning,
        behaviorAffectsPrizeDecision: false,
        advisoryReviewSuggested: behaviorWarning,
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

function makeHttpResponse({
  status = 200,
  body = makeReport(),
  redirected = false,
  contentType = "application/json",
  rawText,
} = {}) {
  return {
    status,
    redirected,

    headers: {
      get(name) {
        if (name === "content-type") {
          return contentType;
        }

        if (name === "content-length") {
          return null;
        }

        return null;
      },
    },

    text: vi.fn().mockResolvedValue(
      rawText ?? JSON.stringify(body)
    ),
  };
}

function compose(fetchMock, options = {}) {
  const transport =
    createSandboxFraudHttpTransport({
      fetchImpl: fetchMock,
    });

  return createFraudReportSandboxAdapter({
    enabled: true,
    baseUrl: BASE_URL,
    transport,
    timeoutMs: 1000,
    ...options,
  });
}

function request() {
  return {
    sessionIds: [SESSION_ID],
    adminToken: "synthetic-test-token",
  };
}

describe("HNC Fraud Report Integration Security", () => {

  // TEST 1
  it("passes a valid response through both layers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse()
    );

    const adapter = compose(fetchMock);

    const result = await adapter.getReport(request());

    expect(result.found).toBe(1);
    expect(result.reportType).toBe("observational");
    expect(result.reports[0].readOnly).toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      `${BASE_URL}/sandbox/fraud-report`
    );

    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("error");
    expect(options.credentials).toBe("omit");
    expect(options.cache).toBe("no-store");
    expect(options.referrerPolicy).toBe("no-referrer");
  });

  // TEST 2
  it("preserves advisory-only behavior warnings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({
        body: makeReport({
          behaviorWarning: true,
        }),
      })
    );

    const adapter = compose(fetchMock);

    const result = await adapter.getReport(request());

    const report = result.reports[0];

    expect(report.behavior.reviewSuggested).toBe(true);
    expect(report.integrity.reviewRequired).toBe(false);

    expect(
      report.preliminaryReviewRequired
    ).toBe(false);

    expect(
      report.behaviorAffectsPrizeDecision
    ).toBe(false);
  });

  // TEST 3
  it("preserves separate integrity review results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({
        body: makeReport({
          integrityWarning: true,
        }),
      })
    );

    const adapter = compose(fetchMock);

    const result = await adapter.getReport(request());

    const report = result.reports[0];

    expect(report.integrity.reviewRequired).toBe(true);

    expect(
      report.integrity.riskReasons
    ).toContain("MONKEY_SCORE_MISMATCH");

    expect(report.behavior.reviewSuggested).toBe(false);
  });

  // TEST 4
  it("rejects sensitive fields from backend JSON", async () => {
    const body = makeReport();

    body.reports[0].qrToken = "secret-qr-token";

    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({ body })
    );

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow("INVALID_REPORT_SESSION");
  });

  // TEST 5
  it("rejects unsafe decision state", async () => {
    const body = makeReport();

    body.reports[0].behaviorAffectsPrizeDecision = true;

    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({ body })
    );

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "UNSAFE_REPORT_DECISION_STATE"
    );
  });

  // TEST 6
  it("sanitizes authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({
        status: 401,
      })
    );

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "SANDBOX_REQUEST_FAILED"
    );
  });

  // TEST 7
  it("sanitizes redirect failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({
        status: 302,
        redirected: true,
      })
    );

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "SANDBOX_REQUEST_FAILED"
    );
  });

  // TEST 8
  it("rejects malformed HTTP JSON safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse({
        rawText: "{malformed-json",
      })
    );

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "SANDBOX_REQUEST_FAILED"
    );
  });

  // TEST 9
  it("rejects missing token before HTTP transport", async () => {
    const fetchMock = vi.fn();

    const adapter = compose(fetchMock);

    await expect(
      adapter.getReport({
        sessionIds: [SESSION_ID],
      })
    ).rejects.toThrow("INVALID_ADMIN_TOKEN");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // TEST 10
  it("prevents HTTP access when adapter is disabled", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    const adapter =
      createFraudReportSandboxAdapter({
        transport,
        baseUrl: BASE_URL,
      });

    expect(adapter.enabled).toBe(false);

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "SANDBOX_ADAPTER_DISABLED"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // TEST 11
  it("rejects external destination during composition", () => {
    const fetchMock = vi.fn();

    expect(() =>
      compose(fetchMock, {
        baseUrl: "https://api.hotncool.qa",
      })
    ).toThrow("UNTRUSTED_SANDBOX_ORIGIN");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // TEST 12
  it("times out and aborts a stalled HTTP request", async () => {
    let capturedSignal;

    const fetchMock = vi.fn((_url, options) => {
      capturedSignal = options.signal;

      // Simulate a transport that waits until aborted.
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => {
            reject(new Error("mock fetch aborted"));
          },
          { once: true }
        );
      });
    });

    const adapter = compose(fetchMock, {
      timeoutMs: 30,
    });

    await expect(
      adapter.getReport(request())
    ).rejects.toThrow(
      "SANDBOX_REQUEST_TIMEOUT"
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(capturedSignal.aborted).toBe(true);
  });

  // TEST 13
  it("never forwards browser cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeHttpResponse()
    );

    const adapter = compose(fetchMock);

    await adapter.getReport(request());

    const options = fetchMock.mock.calls[0][1];

    expect(options.credentials).toBe("omit");

    expect(options.headers).not.toHaveProperty(
      "Cookie"
    );

    expect(options.headers).not.toHaveProperty(
      "cookie"
    );
  });

});
