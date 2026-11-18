
import { describe, it, expect } from "vitest";

import fs from "node:fs";
import path from "node:path";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

// =====================================================
// STEP 15R.22J — ACTUAL BACKEND JSON CONTRACT
//
// Reads a locally generated sandbox JSON file.
// Does not connect to MongoDB or make HTTP requests.
// =====================================================

const fixturePath = path.resolve(
  process.cwd(),
  "../server/scripts/fixtures/fraudReportBackend.contract.json"
);

if (!fs.existsSync(fixturePath)) {
  throw new Error(
    "BACKEND_CONTRACT_FIXTURE_MISSING: Run the sandbox export first"
  );
}

const rawJson = fs.readFileSync(fixturePath, "utf8");
const backendResponse = JSON.parse(rawJson);

describe("HNC Actual Backend Fraud Report Contract", () => {
  it("accepts the actual serialized backend response", () => {
    const result = validateFraudReportResponse(
      backendResponse
    );

    expect(result.reportType).toBe("observational");
    expect(result.found).toBe(2);
    expect(result.missing).toBe(1);
  });

  it("preserves assessment versions and advisory behavior", () => {
    const result = validateFraudReportResponse(
      backendResponse
    );

    for (const report of result.reports) {
      expect(report.integrity.assessmentVersion).toBe(2);
      expect(report.behavior.behaviorVersion).toBe(1);
      expect(report.behavior.enforcementAllowed).toBe(false);

      expect(report.preliminaryReviewRequired).toBe(
        report.integrity.reviewRequired
      );
    }
  });

  it("validates the actual missing-session result", () => {
    const result = validateFraudReportResponse(
      backendResponse
    );

    expect(result.notFound).toHaveLength(1);
    expect(result.evaluated).toBe(3);
    expect(result.requested).toBe(3);
  });

  it("rejects no required security boundaries", () => {
    const result = validateFraudReportResponse(
      backendResponse
    );

    expect(result.databaseModified).toBe(false);
    expect(result.decisionModified).toBe(false);
    expect(result.prizeAllocated).toBe(false);

    for (const report of result.reports) {
      expect(report.readOnly).toBe(true);
      expect(report.behaviorAffectsPrizeDecision).toBe(false);
      expect(report).not.toHaveProperty("email");
      expect(report).not.toHaveProperty("userId");
      expect(report).not.toHaveProperty("sessionTokenHash");
    }
  });
});
