
"use strict";

// =====================================================
// HNC Fraud Report Response Validator
// Step 15R.22K — Contract Compatibility Hardening
//
// Pure validation.
// No HTTP requests.
// No database operations.
// No prize allocation.
// =====================================================

const MAX_SESSIONS = 25;
const MAX_SIGNALS = 30;

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const SIGNAL_CODE = /^[A-Z][A-Z0-9_]{0,79}$/;

const ALLOWED_GAMES = new Set([
  "monkey",
  "perfect-shot",
]);

const ALLOWED_REPORT_KEYS = new Set([
  "campaignId",
  "requested",
  "evaluated",
  "found",
  "missing",
  "reports",
  "notFound",
  "reportType",
  "databaseModified",
  "prizeAllocated",
  "decisionModified",
]);

const ALLOWED_SESSION_KEYS = new Set([
  "sessionId",
  "campaignId",
  "gameId",
  "status",
  "outcome",
  "score",
  "startedAt",
  "completedAt",
  "integrity",
  "behavior",
  "preliminaryReviewRequired",
  "behaviorAffectsPrizeDecision",
  "advisoryReviewSuggested",
  "readOnly",
]);

const ALLOWED_INTEGRITY_KEYS = new Set([
  "assessmentVersion",
  "reviewRequired",
  "riskReasons",
]);

const ALLOWED_BEHAVIOR_KEYS = new Set([
  "behaviorVersion",
  "reviewSuggested",
  "signals",
  "enforcementAllowed",
]);

function reject(code) {
  throw new Error(code);
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validKeys(value, allowed) {
  return Object.keys(value).every((key) =>
    allowed.has(key)
  );
}

function validCodeList(value) {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SIGNALS &&
    value.every(
      (item) =>
        typeof item === "string" &&
        SIGNAL_CODE.test(item)
    )
  );
}

function validDate(value) {
  return (
    value === null ||
    (
      typeof value === "string" &&
      !Number.isNaN(Date.parse(value))
    )
  );
}

// =====================================================
// VALIDATE EACH SESSION
// =====================================================

function validateSession(report, campaignId) {
  // -----------------------------------------------
  // Allowed fields
  // -----------------------------------------------

  if (
    !isObject(report) ||
    !validKeys(report, ALLOWED_SESSION_KEYS)
  ) {
    reject("INVALID_REPORT_SESSION");
  }

  // -----------------------------------------------
  // Session identity
  // -----------------------------------------------

  if (
    typeof report.sessionId !== "string" ||
    !OBJECT_ID.test(report.sessionId) ||
    report.campaignId !== campaignId ||
    !ALLOWED_GAMES.has(report.gameId)
  ) {
    reject("INVALID_REPORT_IDENTITY");
  }

  // -----------------------------------------------
  // Gameplay fields
  // -----------------------------------------------

  if (
    typeof report.status !== "string" ||
    typeof report.outcome !== "string" ||
    !Number.isFinite(report.score) ||
    !validDate(report.startedAt) ||
    !validDate(report.completedAt)
  ) {
    reject("INVALID_REPORT_GAMEPLAY");
  }

  // -----------------------------------------------
  // Assessment objects
  // -----------------------------------------------

  const integrity = report.integrity;
  const behavior = report.behavior;

  if (
    !isObject(integrity) ||
    !isObject(behavior)
  ) {
    reject("INVALID_REPORT_ASSESSMENT");
  }

  // -----------------------------------------------
  // Integrity Assessment V2
  // -----------------------------------------------

  if (
    !validKeys(
      integrity,
      ALLOWED_INTEGRITY_KEYS
    ) ||
    integrity.assessmentVersion !== 2 ||
    typeof integrity.reviewRequired !== "boolean" ||
    !validCodeList(integrity.riskReasons)
  ) {
    reject("INVALID_INTEGRITY_ASSESSMENT");
  }

  // -----------------------------------------------
  // Behavioral Assessment V1
  // -----------------------------------------------

  if (
    !validKeys(
      behavior,
      ALLOWED_BEHAVIOR_KEYS
    ) ||
    behavior.behaviorVersion !== 1 ||
    typeof behavior.reviewSuggested !== "boolean" ||
    !validCodeList(behavior.signals) ||
    behavior.enforcementAllowed !== false
  ) {
    reject("INVALID_BEHAVIOR_ASSESSMENT");
  }

  // =================================================
  // STEP 15R.22K — CONTRACT HARDENING
  // =================================================

  // Integrity findings must not be hidden
  // behind a false reviewRequired flag.

  if (
    integrity.riskReasons.length > 0 &&
    integrity.reviewRequired !== true
  ) {
    reject("INCONSISTENT_INTEGRITY_FINDINGS");
  }

  // Behavioral findings must not be hidden
  // behind a false reviewSuggested flag.

  if (
    behavior.signals.length > 0 &&
    behavior.reviewSuggested !== true
  ) {
    reject("INCONSISTENT_BEHAVIOR_FINDINGS");
  }

  // Behavior warnings are advisory only.
  //
  // They do not independently trigger:
  // - Prize rejection
  // - Prize allocation changes
  // - Integrity review decisions

  // -----------------------------------------------
  // Decision and read-only consistency
  // -----------------------------------------------

  if (
    report.preliminaryReviewRequired !==
      integrity.reviewRequired ||
    report.behaviorAffectsPrizeDecision !== false ||
    report.advisoryReviewSuggested !==
      behavior.reviewSuggested ||
    report.readOnly !== true
  ) {
    reject("UNSAFE_REPORT_DECISION_STATE");
  }

  // -----------------------------------------------
  // Return sanitized, validated structure
  // -----------------------------------------------

  return {
    ...report,

    sessionId: report.sessionId.toLowerCase(),

    integrity: {
      ...integrity,
      riskReasons: [...integrity.riskReasons],
    },

    behavior: {
      ...behavior,
      signals: [...behavior.signals],
    },
  };
}

// =====================================================
// VALIDATE COMPLETE FRAUD REPORT RESPONSE
// =====================================================

export function validateFraudReportResponse(data) {
  // -----------------------------------------------
  // Validate top-level structure
  // -----------------------------------------------

  if (
    !isObject(data) ||
    !validKeys(data, ALLOWED_REPORT_KEYS)
  ) {
    reject("INVALID_FRAUD_REPORT_RESPONSE");
  }

  // -----------------------------------------------
  // Validate observational safety flags
  // -----------------------------------------------

  if (
    typeof data.campaignId !== "string" ||
    !data.campaignId.trim() ||
    data.reportType !== "observational" ||
    data.databaseModified !== false ||
    data.prizeAllocated !== false ||
    data.decisionModified !== false
  ) {
    reject("UNSAFE_FRAUD_REPORT_RESPONSE");
  }

  // -----------------------------------------------
  // Validate collection limits
  // -----------------------------------------------

  if (
    !Array.isArray(data.reports) ||
    !Array.isArray(data.notFound) ||
    data.reports.length > MAX_SESSIONS ||
    data.notFound.length > MAX_SESSIONS
  ) {
    reject("INVALID_FRAUD_REPORT_COLLECTION");
  }

  // -----------------------------------------------
  // Validate response counts
  // -----------------------------------------------

  const counts = [
    data.requested,
    data.evaluated,
    data.found,
    data.missing,
  ];

  if (
    !counts.every(
      (count) =>
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= MAX_SESSIONS
    ) ||
    data.found !== data.reports.length ||
    data.missing !== data.notFound.length ||
    data.evaluated !== data.found + data.missing ||
    data.requested !== data.evaluated
  ) {
    reject("INVALID_FRAUD_REPORT_COUNTS");
  }

  // -----------------------------------------------
  // Validate all session reports
  // -----------------------------------------------

  const reports = data.reports.map((report) =>
    validateSession(report, data.campaignId)
  );

  // -----------------------------------------------
  // Validate missing session identifiers
  // -----------------------------------------------

  const notFound = data.notFound.map((id) => {
    if (
      typeof id !== "string" ||
      !OBJECT_ID.test(id)
    ) {
      reject("INVALID_MISSING_SESSION_ID");
    }

    return id.toLowerCase();
  });

  // -----------------------------------------------
  // Prevent duplicate session identifiers
  // -----------------------------------------------

  const allIds = [
    ...reports.map((report) => report.sessionId),
    ...notFound,
  ];

  if (new Set(allIds).size !== allIds.length) {
    reject("DUPLICATE_REPORT_SESSION");
  }

  // -----------------------------------------------
  // Return validated response
  // -----------------------------------------------

  return {
    ...data,
    reports,
    notFound,
  };
}
