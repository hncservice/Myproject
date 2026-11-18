
"use strict";

// HNC Fraud Reporting — Sandbox API Boundary
// No production API access.
// Disabled by default.
// Does not make requests unless explicitly called.

export const FRAUD_REPORT_SANDBOX_ENABLED =
  import.meta.env.MODE === "test" &&
  import.meta.env.VITE_FRAUD_REPORT_SANDBOX_ENABLED === "true";

const MAX_SESSIONS = 25;

export function validateFraudReportRequest(sessionIds) {
  if (
    !Array.isArray(sessionIds) ||
    sessionIds.length < 1 ||
    sessionIds.length > MAX_SESSIONS
  ) {
    throw new Error("INVALID_SESSION_FILTER");
  }

  if (
    !sessionIds.every(
      (id) =>
        typeof id === "string" &&
        /^[a-f0-9]{24}$/i.test(id)
    )
  ) {
    throw new Error("INVALID_SESSION_ID");
  }

  const normalized = sessionIds.map((id) =>
    id.toLowerCase()
  );

  if (new Set(normalized).size !== normalized.length) {
    throw new Error("DUPLICATE_SESSION_IDS");
  }

  return normalized;
}

export async function fetchSandboxFraudReport({
  sessionIds,
  adminToken,
} = {}) {
  if (!FRAUD_REPORT_SANDBOX_ENABLED) {
    throw new Error("FRAUD_REPORT_API_DISABLED");
  }

  const ids = validateFraudReportRequest(sessionIds);

  if (
    typeof adminToken !== "string" ||
    !adminToken.trim()
  ) {
    throw new Error("ADMIN_TOKEN_REQUIRED");
  }

  // Deliberately no HTTP request yet.
  // Backend integration remains disabled until
  // the sandbox route has been reviewed and approved.
  void ids;

  throw new Error("FRAUD_REPORT_TRANSPORT_NOT_CONFIGURED");
}
