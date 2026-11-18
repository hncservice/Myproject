
"use strict";

// =====================================================
// HNC FRAUD REPORT SANDBOX ADAPTER
// Step 15R.22O — Part 2 FINAL
//
// SECURITY:
// - Disabled by default
// - Explicit transport injection only
// - Localhost-only configuration
// - No production endpoint support
// - No authentication token storage
// - Transport errors are sanitized
// - Response validation is isolated
// - Request timeout and abort protection
// - No prize allocation
// =====================================================

import {
  validateFraudReportRequest,
} from "./fraudReportApi";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

// =====================================================
// CONFIGURATION
// =====================================================

const MAX_TIMEOUT_MS = 10000;
const DEFAULT_TIMEOUT_MS = 5000;

const ENDPOINT = "/sandbox/fraud-report";

const ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
]);

// =====================================================
// ERROR HELPER
// =====================================================

function fail(code) {
  throw new Error(code);
}

// =====================================================
// SANDBOX URL VALIDATION
// =====================================================

function validateLocalBaseUrl(baseUrl) {
  if (
    typeof baseUrl !== "string" ||
    !baseUrl.trim()
  ) {
    fail("INVALID_SANDBOX_URL");
  }

  let url;

  try {
    url = new URL(baseUrl);
  } catch {
    fail("INVALID_SANDBOX_URL");
  }

  if (
    url.protocol !== "http:" ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    fail("UNTRUSTED_SANDBOX_ORIGIN");
  }

  return url.origin;
}

// =====================================================
// AUTHENTICATION TOKEN VALIDATION
// =====================================================

function validateToken(adminToken) {
  if (
    typeof adminToken !== "string" ||
    !adminToken.trim() ||
    adminToken.length > 8192 ||
    /[\r\n]/.test(adminToken)
  ) {
    fail("INVALID_ADMIN_TOKEN");
  }

  return adminToken;
}

// =====================================================
// SANDBOX ADAPTER FACTORY
// =====================================================

export function createFraudReportSandboxAdapter({
  enabled = false,
  baseUrl,
  transport,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {

  // ===================================================
  // 1. DISABLED BY DEFAULT
  // ===================================================

  if (enabled !== true) {
    return {
      enabled: false,

      async getReport() {
        fail("SANDBOX_ADAPTER_DISABLED");
      },
    };
  }

  // ===================================================
  // 2. REQUIRE EXPLICIT TRANSPORT
  // ===================================================

  if (typeof transport !== "function") {
    fail("SANDBOX_TRANSPORT_REQUIRED");
  }

  // ===================================================
  // 3. VALIDATE LOCAL SANDBOX URL
  // ===================================================

  const origin = validateLocalBaseUrl(baseUrl);

  // ===================================================
  // 4. VALIDATE TIMEOUT CONFIGURATION
  // ===================================================

  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    fail("INVALID_SANDBOX_TIMEOUT");
  }

  // ===================================================
  // 5. RETURN SANDBOX ADAPTER
  // ===================================================

  return {
    enabled: true,

    async getReport({
      sessionIds,
      adminToken,
    } = {}) {

      // ===============================================
      // STEP A — VALIDATE REQUEST BEFORE TRANSPORT
      // ===============================================

      const ids = validateFraudReportRequest(
        sessionIds
      );

      const token = validateToken(adminToken);

      // ===============================================
      // STEP B — INITIALIZE CANCELLATION
      // ===============================================

      const controller = new AbortController();

      let timer;
      let timedOut = false;
      let rawResponse;

      // ===============================================
      // STEP C — EXECUTE TRANSPORT
      //
      // All transport exceptions are treated as
      // untrusted, regardless of error message.
      // ===============================================

      try {

        // ---------------------------------------------
        // Timeout promise
        // ---------------------------------------------

        const timeoutPromise = new Promise(
          (_, reject) => {

            timer = setTimeout(() => {

              timedOut = true;

              controller.abort();

              reject(
                new Error("SANDBOX_REQUEST_TIMEOUT")
              );

            }, timeoutMs);

          }
        );

        // ---------------------------------------------
        // Transport request promise
        // ---------------------------------------------

        const requestPromise = Promise.resolve().then(
          () => {

            if (controller.signal.aborted) {
              fail("SANDBOX_REQUEST_ABORTED");
            }

            return transport({

              url: `${origin}${ENDPOINT}`,

              method: "POST",

              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },

              body: JSON.stringify({
                sessionIds: ids,
                limit: ids.length,
              }),

              signal: controller.signal,

              redirect: "error",
              credentials: "omit",
              cache: "no-store",

            });

          }
        );

        // ---------------------------------------------
        // Execute request with timeout protection
        // ---------------------------------------------

        rawResponse = await Promise.race([
          requestPromise,
          timeoutPromise,
        ]);

      } catch {

        // =============================================
        // STEP D — TRANSPORT ERROR ISOLATION
        //
        // Never trust error messages from transport.
        //
        // Even if transport throws:
        // INVALID_REPORT_SESSION
        // UNSAFE_REPORT_DECISION_STATE
        //
        // Convert it to SANDBOX_REQUEST_FAILED.
        // =============================================

        if (timedOut) {
          fail("SANDBOX_REQUEST_TIMEOUT");
        }

        fail("SANDBOX_REQUEST_FAILED");

      } finally {

        // Always clear the timeout.
        clearTimeout(timer);

      }

      // ===============================================
      // STEP E — CANCELLATION SAFETY
      // ===============================================

      if (
        controller.signal.aborted ||
        timedOut
      ) {
        fail("SANDBOX_REQUEST_TIMEOUT");
      }

      // ===============================================
      // STEP F — RESPONSE VALIDATION
      //
      // CRITICAL:
      // This must remain OUTSIDE the transport
      // try/catch block.
      //
      // Only errors generated by the real frontend
      // validator can reach the caller unchanged.
      // ===============================================

      return validateFraudReportResponse(
        rawResponse
      );

    },
  };
}
