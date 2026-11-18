
import { describe, it, expect } from "vitest";

import backendReport from "./fixtures/fraudReportBackend.contract.json";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

// =====================================================
// STEP 15R.22S — ACTUAL BACKEND CONTRACT TEST
//
// Synthetic sandbox JSON only.
// No HTTP requests.
// No MongoDB connections.
// No prize allocation.
// =====================================================

const forbiddenFields = new Set([
  "email",
  "userid",
  "password",
  "passwordhash",
  "qrtoken",
  "sessiontoken",
  "sessiontokenhash",
  "authtoken",
  "authorization",
  "phone",
  "mobile",
  "gamestate",
  "events",
]);

function verifyNoSensitiveFields(value) {
  if (Array.isArray(value)) {
    value.forEach(verifyNoSensitiveFields);
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenFields.has(key.toLowerCase())) {
      throw new Error(`FORBIDDEN_REPORT_FIELD: ${key}`);
    }

    verifyNoSensitiveFields(child);
  }
}

describe("HNC Actual Backend Fraud Report Contract", () => {
  it("accepts actual backend JSON through the frontend validator", () => {
    const result = validateFraudReportResponse(backendReport);

    expect(result.found).toBe(2);
    expect(result.missing).toBe(1);
    expect(result.requested).toBe(3);
    expect(result.evaluated).toBe(3);
  });

  it("preserves observational-only restrictions", () => {
    const result = validateFraudReportResponse(backendReport);

    expect(result.reportType).toBe("observational");
    expect(result.databaseModified).toBe(false);
    expect(result.prizeAllocated).toBe(false);
    expect(result.decisionModified).toBe(false);

    for (const session of result.reports) {
      expect(session.readOnly).toBe(true);
      expect(session.behaviorAffectsPrizeDecision).toBe(false);
      expect(session.behavior.enforcementAllowed).toBe(false);
    }
  });

  it("keeps integrity and behavioral assessments independent", () => {
    const result = validateFraudReportResponse(backendReport);

    for (const session of result.reports) {
      expect(session.preliminaryReviewRequired).toBe(
        session.integrity.reviewRequired
      );

      expect(session.advisoryReviewSuggested).toBe(
        session.behavior.reviewSuggested
      );

      expect(session.integrity.assessmentVersion).toBe(2);
      expect(session.behavior.behaviorVersion).toBe(1);
    }
  });

  it("contains no forbidden sensitive fields", () => {
    expect(() => {
      verifyNoSensitiveFields(backendReport);
    }).not.toThrow();
  });

  it("rejects sensitive fields added to the actual backend report", () => {
    const tampered = structuredClone(backendReport);

    tampered.reports[0].qrToken = "synthetic-forbidden-token";

    expect(() => {
      validateFraudReportResponse(tampered);
    }).toThrow();
  });

  it("rejects unsafe prize decision changes", () => {
    const tampered = structuredClone(backendReport);

    tampered.prizeAllocated = true;

    expect(() => {
      validateFraudReportResponse(tampered);
    }).toThrow();
  });
});
