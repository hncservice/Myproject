
import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from "vitest";

import {
  validateFraudReportRequest,
  fetchSandboxFraudReport,
} from "./fraudReportApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Fraud Report API Security", () => {
  const validId = "507f1f77bcf86cd799439011";
  const secondId = "507f191e810c19729de860ea";

  it("accepts valid session IDs", () => {
    expect(
      validateFraudReportRequest([validId])
    ).toEqual([validId]);
  });

  it("rejects an empty session list", () => {
    expect(() =>
      validateFraudReportRequest([])
    ).toThrow("INVALID_SESSION_FILTER");
  });

  it("rejects malformed session IDs", () => {
    expect(() =>
      validateFraudReportRequest(["invalid"])
    ).toThrow("INVALID_SESSION_ID");
  });

  it("rejects duplicate session IDs", () => {
    expect(() =>
      validateFraudReportRequest([validId, validId])
    ).toThrow("DUPLICATE_SESSION_IDS");
  });

  it("rejects more than 25 session IDs", () => {
    const ids = Array.from(
      { length: 26 },
      (_, i) => i.toString(16).padStart(24, "0")
    );

    expect(() =>
      validateFraudReportRequest(ids)
    ).toThrow("INVALID_SESSION_FILTER");
  });

  it("accepts two unique valid IDs", () => {
    expect(
      validateFraudReportRequest([validId, secondId])
    ).toHaveLength(2);
  });

  it("cannot send network requests", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSandboxFraudReport({
        sessionIds: [validId],
        adminToken: "sandbox-test-token",
      })
    ).rejects.toThrow(
      /FRAUD_REPORT_API_DISABLED|FRAUD_REPORT_TRANSPORT_NOT_CONFIGURED/
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
