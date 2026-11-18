
import { describe, it, expect } from "vitest";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

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
          reviewSuggested: true,
          signals: ["HIGHLY_REGULAR_TAP_CADENCE"],
          enforcementAllowed: false,
        },
        preliminaryReviewRequired: false,
        behaviorAffectsPrizeDecision: false,
        advisoryReviewSuggested: true,
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

describe("HNC Fraud Report Response Validation", () => {
  it("accepts a valid observational report", () => {
    const result = validateFraudReportResponse(
      validResponse()
    );

    expect(result.found).toBe(1);
    expect(result.reports[0].behavior.reviewSuggested)
      .toBe(true);
  });

  it("rejects unexpected customer data", () => {
    const data = validResponse();
    data.reports[0].email = "customer@example.com";

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_REPORT_SESSION");
  });

  it("rejects invalid session IDs", () => {
    const data = validResponse();
    data.reports[0].sessionId = "invalid";

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_REPORT_IDENTITY");
  });

  it("rejects unknown assessment versions", () => {
    const data = validResponse();
    data.reports[0].integrity.assessmentVersion = 3;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_INTEGRITY_ASSESSMENT");
  });

  it("rejects behavioral enforcement", () => {
    const data = validResponse();
    data.reports[0].behavior.enforcementAllowed = true;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_BEHAVIOR_ASSESSMENT");
  });

  it("rejects behavioral influence on decisions", () => {
    const data = validResponse();
    data.reports[0].behaviorAffectsPrizeDecision = true;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("UNSAFE_REPORT_DECISION_STATE");
  });

  it("rejects inconsistent preliminary decisions", () => {
    const data = validResponse();
    data.reports[0].preliminaryReviewRequired = true;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("UNSAFE_REPORT_DECISION_STATE");
  });

  it("rejects prize allocation flags", () => {
    const data = validResponse();
    data.prizeAllocated = true;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("UNSAFE_FRAUD_REPORT_RESPONSE");
  });

  it("rejects incorrect report counts", () => {
    const data = validResponse();
    data.found = 2;

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_FRAUD_REPORT_COUNTS");
  });

  it("rejects unknown top-level fields", () => {
    const data = validResponse();
    data.adminToken = "unexpected";

    expect(() =>
      validateFraudReportResponse(data)
    ).toThrow("INVALID_FRAUD_REPORT_RESPONSE");
  });

  it("does not modify the original response", () => {
    const data = validResponse();
    const before = JSON.stringify(data);

    validateFraudReportResponse(data);

    expect(JSON.stringify(data)).toBe(before);
  });
});
