
import { describe, it, expect } from "vitest";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

// =====================================================
// HNC FRAUD REPORT CONTRACT TEST
// STEP 15R.22I
//
// Synthetic examples of the backend's documented
// JSON response shape.
//
// NO HTTP REQUESTS
// NO DATABASE CONNECTIONS
// NO PRIZE ALLOCATION
// =====================================================

const SESSION_1 = "507f1f77bcf86cd799439011";
const SESSION_2 = "507f191e810c19729de860ea";
const SESSION_3 = "507f1f77bcf86cd799439012";

function makeSession({
  sessionId = SESSION_1,
  gameId = "monkey",
  score = 7,
  integrityWarning = false,
  behavioralWarning = false,
} = {}) {
  return {
    sessionId,
    campaignId: "hnc-sandbox",
    gameId,
    status: "completed",
    outcome: "qualified",
    score,

    // JSON serialization of MongoDB Date values.
    startedAt: "2026-10-22T10:00:00.000Z",
    completedAt: "2026-10-22T10:00:20.000Z",

    integrity: {
      assessmentVersion: 2,
      reviewRequired: integrityWarning,
      riskReasons: integrityWarning
        ? ["MONKEY_SCORE_MISMATCH"]
        : [],
    },

    behavior: {
      behaviorVersion: 1,
      reviewSuggested: behavioralWarning,
      signals: behavioralWarning
        ? ["HIGHLY_REGULAR_TAP_CADENCE"]
        : [],
      enforcementAllowed: false,
    },

    preliminaryReviewRequired: integrityWarning,
    behaviorAffectsPrizeDecision: false,
    advisoryReviewSuggested: behavioralWarning,
    readOnly: true,
  };
}

function makeResponse({
  reports = [],
  notFound = [],
} = {}) {
  return {
    campaignId: "hnc-sandbox",

    requested: reports.length + notFound.length,
    evaluated: reports.length + notFound.length,
    found: reports.length,
    missing: notFound.length,

    reports,
    notFound,

    reportType: "observational",
    databaseModified: false,
    prizeAllocated: false,
    decisionModified: false,
  };
}

describe("HNC Fraud Report API Contract", () => {

  // TEST 1
  it("accepts the normal Monkey report shape", () => {
    const response = makeResponse({
      reports: [makeSession()],
    });

    const result =
      validateFraudReportResponse(response);

    expect(result.found).toBe(1);
    expect(result.reports[0].gameId).toBe("monkey");
    expect(result.reports[0].integrity.reviewRequired)
      .toBe(false);
  });

  // TEST 2
  it("accepts separate behavioral warnings", () => {
    const response = makeResponse({
      reports: [
        makeSession({
          behavioralWarning: true,
        }),
      ],
    });

    const result =
      validateFraudReportResponse(response);

    expect(
      result.reports[0].behavior.reviewSuggested
    ).toBe(true);

    expect(
      result.reports[0].integrity.reviewRequired
    ).toBe(false);

    expect(
      result.reports[0].behaviorAffectsPrizeDecision
    ).toBe(false);
  });

  // TEST 3
  it("accepts integrity review findings", () => {
    const response = makeResponse({
      reports: [
        makeSession({
          integrityWarning: true,
          score: 99,
        }),
      ],
    });

    const result =
      validateFraudReportResponse(response);

    expect(
      result.reports[0].preliminaryReviewRequired
    ).toBe(true);

    expect(
      result.reports[0].integrity.riskReasons
    ).toContain("MONKEY_SCORE_MISMATCH");
  });

  // TEST 4
  it("accepts a Perfect Shot report", () => {
    const response = makeResponse({
      reports: [
        makeSession({
          gameId: "perfect-shot",
          score: 380,
        }),
      ],
    });

    const result =
      validateFraudReportResponse(response);

    expect(result.reports[0].gameId)
      .toBe("perfect-shot");
  });

  // TEST 5
  it("accepts mixed found and missing sessions", () => {
    const response = makeResponse({
      reports: [makeSession()],
      notFound: [SESSION_2],
    });

    const result =
      validateFraudReportResponse(response);

    expect(result.requested).toBe(2);
    expect(result.evaluated).toBe(2);
    expect(result.found).toBe(1);
    expect(result.missing).toBe(1);
    expect(result.notFound).toContain(SESSION_2);
  });

  // TEST 6
  it("accepts a report with no matching sessions", () => {
    const response = makeResponse({
      notFound: [SESSION_1],
    });

    const result =
      validateFraudReportResponse(response);

    expect(result.found).toBe(0);
    expect(result.missing).toBe(1);
    expect(result.reports).toHaveLength(0);
  });

  // TEST 7
  it("accepts multiple supported game sessions", () => {
    const response = makeResponse({
      reports: [
        makeSession({ sessionId: SESSION_1 }),
        makeSession({
          sessionId: SESSION_2,
          behavioralWarning: true,
        }),
        makeSession({
          sessionId: SESSION_3,
          gameId: "perfect-shot",
          score: 380,
        }),
      ],
    });

    const result =
      validateFraudReportResponse(response);

    expect(result.found).toBe(3);
    expect(result.reports).toHaveLength(3);
  });

  // TEST 8
  it("rejects mismatched campaign identifiers", () => {
    const response = makeResponse({
      reports: [makeSession()],
    });

    response.reports[0].campaignId =
      "different-campaign";

    expect(() =>
      validateFraudReportResponse(response)
    ).toThrow("INVALID_REPORT_IDENTITY");
  });

  // TEST 9
  it("rejects inconsistent missing-session counts", () => {
    const response = makeResponse({
      notFound: [SESSION_1],
    });

    response.missing = 0;

    expect(() =>
      validateFraudReportResponse(response)
    ).toThrow("INVALID_FRAUD_REPORT_COUNTS");
  });

  // TEST 10
  it("rejects duplicate session identifiers", () => {
    const response = makeResponse({
      reports: [makeSession()],
      notFound: [SESSION_1],
    });

    expect(() =>
      validateFraudReportResponse(response)
    ).toThrow("DUPLICATE_REPORT_SESSION");
  });

});
