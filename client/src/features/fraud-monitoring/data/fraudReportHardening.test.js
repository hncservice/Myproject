
import { describe, it, expect } from "vitest";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

const ID = "507f1f77bcf86cd799439011";

function makeReport() {
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

describe("HNC Fraud Report Contract Hardening", () => {
  it("accepts a consistent normal report", () => {
    const report = makeReport();

    expect(
      validateFraudReportResponse(report).found
    ).toBe(1);
  });

  it("rejects hidden integrity findings", () => {
    const report = makeReport();

    report.reports[0].integrity.riskReasons = [
      "MONKEY_SCORE_MISMATCH",
    ];

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("INCONSISTENT_INTEGRITY_FINDINGS");
  });

  it("rejects hidden behavioral signals", () => {
    const report = makeReport();

    report.reports[0].behavior.signals = [
      "HIGHLY_REGULAR_TAP_CADENCE",
    ];

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("INCONSISTENT_BEHAVIOR_FINDINGS");
  });

  it("keeps behavior-only warnings advisory", () => {
    const report = makeReport();
    const session = report.reports[0];

    session.behavior.signals = [
      "HIGHLY_REGULAR_TAP_CADENCE",
    ];

    session.behavior.reviewSuggested = true;
    session.advisoryReviewSuggested = true;

    const validated =
      validateFraudReportResponse(report);

    expect(
      validated.reports[0].preliminaryReviewRequired
    ).toBe(false);

    expect(
      validated.reports[0].behaviorAffectsPrizeDecision
    ).toBe(false);
  });

  it("rejects changed integrity assessment version", () => {
    const report = makeReport();

    report.reports[0].integrity.assessmentVersion = 3;

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("INVALID_INTEGRITY_ASSESSMENT");
  });

  it("rejects additional sensitive session fields", () => {
    const report = makeReport();

    report.reports[0].qrToken =
      "unexpected-secret";

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("INVALID_REPORT_SESSION");
  });

  it("rejects attempts to make reports writable", () => {
    const report = makeReport();

    report.reports[0].readOnly = false;

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("UNSAFE_REPORT_DECISION_STATE");
  });

  it("rejects inconsistent found counts", () => {
    const report = makeReport();

    report.found = 0;

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("INVALID_FRAUD_REPORT_COUNTS");
  });

  it("rejects decision modification indicators", () => {
    const report = makeReport();

    report.decisionModified = true;

    expect(() =>
      validateFraudReportResponse(report)
    ).toThrow("UNSAFE_FRAUD_REPORT_RESPONSE");
  });
});
