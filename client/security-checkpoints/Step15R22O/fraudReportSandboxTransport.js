
"use strict";

// =====================================================
// HNC FRAUD REPORT SANDBOX HTTP TRANSPORT
// Step 15R.22O — Part 3
//
// SECURITY:
// - Explicit fetch injection only
// - Localhost-only destinations
// - No automatic network connections
// - POST requests only
// - No redirects or browser credentials
// - Strict request validation
// - Maximum response: 256 KiB
// - Bounded JSON response streaming
// - Abort-aware stream reading
// - Non-blocking cancellation cleanup
// - No prize allocation
// =====================================================

const ENDPOINT = "/sandbox/fraud-report";
const MAX_RESPONSE_BYTES = 262144;

// =====================================================
// ERROR HELPER
// =====================================================

function fail(code) {
  throw new Error(code);
}

// =====================================================
// 1. DESTINATION VALIDATION
// =====================================================

function validateDestination(rawUrl) {
  if (typeof rawUrl !== "string") {
    fail("UNTRUSTED_TRANSPORT_DESTINATION");
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    fail("UNTRUSTED_TRANSPORT_DESTINATION");
  }

  const allowedHosts = new Set([
    "127.0.0.1",
    "localhost",
  ]);

  if (
    url.protocol !== "http:" ||
    !allowedHosts.has(url.hostname) ||
    !url.port ||
    url.pathname !== ENDPOINT ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== `${url.origin}${ENDPOINT}`
  ) {
    fail("UNTRUSTED_TRANSPORT_DESTINATION");
  }

  return url.href;
}

// =====================================================
// 2. REQUEST VALIDATION
// =====================================================

function validateRequest(request) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    fail("INVALID_TRANSPORT_REQUEST");
  }

  const url = validateDestination(request.url);

  if (
    request.method !== "POST" ||
    request.redirect !== "error" ||
    request.credentials !== "omit" ||
    request.cache !== "no-store" ||
    typeof request.headers?.Authorization !== "string" ||
    !/^Bearer [^\s]+$/.test(
      request.headers.Authorization
    ) ||
    request.headers["Content-Type"] !==
      "application/json" ||
    typeof request.body !== "string" ||
    !(request.signal instanceof AbortSignal)
  ) {
    fail("INVALID_TRANSPORT_REQUEST");
  }

  let body;

  try {
    body = JSON.parse(request.body);
  } catch {
    fail("INVALID_TRANSPORT_BODY");
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2 ||
    !Array.isArray(body.sessionIds) ||
    body.sessionIds.length < 1 ||
    body.sessionIds.length > 25 ||
    body.limit !== body.sessionIds.length ||
    !body.sessionIds.every(
      (id) =>
        typeof id === "string" &&
        /^[a-f0-9]{24}$/i.test(id)
    ) ||
    new Set(
      body.sessionIds.map((id) => id.toLowerCase())
    ).size !== body.sessionIds.length
  ) {
    fail("INVALID_TRANSPORT_BODY");
  }

  if (request.signal.aborted) {
    fail("SANDBOX_REQUEST_ABORTED");
  }

  return url;
}

// =====================================================
// 3. HTTP RESPONSE VALIDATION
// =====================================================

function validateResponse(response) {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.status !== "number" ||
    typeof response.headers?.get !== "function"
  ) {
    fail("INVALID_TRANSPORT_RESPONSE");
  }

  if (
    response.redirected === true ||
    (
      response.status >= 300 &&
      response.status < 400
    )
  ) {
    fail("SANDBOX_REDIRECT_REJECTED");
  }

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    fail("SANDBOX_AUTHORIZATION_FAILED");
  }

  if (response.status !== 200) {
    fail("SANDBOX_HTTP_ERROR");
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (
    !/^application\/json(?:\s*;|$)/i.test(
      contentType
    )
  ) {
    fail("INVALID_TRANSPORT_CONTENT_TYPE");
  }

  const lengthHeader =
    response.headers.get("content-length");

  if (lengthHeader !== null) {
    if (
      !/^\d+$/.test(lengthHeader) ||
      !Number.isSafeInteger(Number(lengthHeader)) ||
      Number(lengthHeader) > MAX_RESPONSE_BYTES
    ) {
      fail("SANDBOX_RESPONSE_TOO_LARGE");
    }
  }
}

// =====================================================
// 4. ABORT-AWARE STREAM READING
//
// Prevents a stalled reader.read() from blocking
// request rejection after an abort signal.
// =====================================================

async function readChunkOrAbort(reader, signal) {
  if (signal.aborted) {
    fail("SANDBOX_REQUEST_ABORTED");
  }

  let abortHandler;

  const abortPromise = new Promise(
    (_, reject) => {
      abortHandler = () => {
        reject(
          new Error("SANDBOX_REQUEST_ABORTED")
        );
      };

      signal.addEventListener(
        "abort",
        abortHandler,
        { once: true }
      );
    }
  );

  try {
    if (signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    return await Promise.race([
      Promise.resolve().then(() => reader.read()),
      abortPromise,
    ]);
  } finally {
    signal.removeEventListener(
      "abort",
      abortHandler
    );
  }
}

// =====================================================
// 5. BOUNDED RESPONSE READER
//
// Enforces a 256 KiB decoded HTTP body limit.
// Handles stalled streaming reads and cancellation.
// =====================================================

async function readBoundedResponse(response, signal) {
  if (signal.aborted) {
    fail("SANDBOX_REQUEST_ABORTED");
  }

  // ---------------------------------------------------
  // LEGACY TEST-MOCK COMPATIBILITY
  //
  // Existing tests may provide synthetic responses
  // with text() but without a body property.
  //
  // This path is NOT memory-bounded before text()
  // completes. It must be removed or restricted
  // before real-network activation.
  // ---------------------------------------------------

  if (response.body === undefined) {
    if (typeof response.text !== "function") {
      fail("INVALID_TRANSPORT_RESPONSE");
    }

    let abortHandler;

    const abortPromise = new Promise(
      (_, reject) => {
        abortHandler = () => {
          reject(
            new Error("SANDBOX_REQUEST_ABORTED")
          );
        };

        signal.addEventListener(
          "abort",
          abortHandler,
          { once: true }
        );
      }
    );

    let raw;

    try {
      if (signal.aborted) {
        fail("SANDBOX_REQUEST_ABORTED");
      }

      raw = await Promise.race([
        Promise.resolve().then(
          () => response.text()
        ),
        abortPromise,
      ]);
    } catch {
      if (signal.aborted) {
        fail("SANDBOX_REQUEST_ABORTED");
      }

      fail("SANDBOX_RESPONSE_READ_FAILED");
    } finally {
      signal.removeEventListener(
        "abort",
        abortHandler
      );
    }

    if (signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    if (
      typeof raw !== "string" ||
      new TextEncoder().encode(raw).byteLength >
        MAX_RESPONSE_BYTES
    ) {
      fail("SANDBOX_RESPONSE_TOO_LARGE");
    }

    return raw;
  }

  // ---------------------------------------------------
  // STREAM VALIDATION
  // ---------------------------------------------------

  if (
    !response.body ||
    typeof response.body.getReader !== "function"
  ) {
    fail("INVALID_TRANSPORT_RESPONSE");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder(
    "utf-8",
    { fatal: true }
  );

  const chunks = [];

  let totalBytes = 0;
  let finished = false;

  try {
    while (true) {
      if (signal.aborted) {
        fail("SANDBOX_REQUEST_ABORTED");
      }

      // An abort can interrupt this read,
      // even if the stream never produces data.
      const { done, value } =
        await readChunkOrAbort(
          reader,
          signal
        );

      if (signal.aborted) {
        fail("SANDBOX_REQUEST_ABORTED");
      }

      if (done) {
        finished = true;
        break;
      }

      // Cross-realm Uint8Array validation
      // for Vitest/jsdom environments.
      const isByteChunk =
        value !== null &&
        typeof value === "object" &&
        ArrayBuffer.isView(value) &&
        Object.prototype.toString.call(
          value
        ) === "[object Uint8Array]" &&
        typeof value.byteLength === "number";

      if (!isByteChunk) {
        fail("INVALID_TRANSPORT_RESPONSE");
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
        fail("SANDBOX_RESPONSE_TOO_LARGE");
      }

      chunks.push(
        decoder.decode(
          value,
          { stream: true }
        )
      );
    }

    if (signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    chunks.push(decoder.decode());

    return chunks.join("");

  } catch (error) {
    const code = error?.message;

    if (
      code === "SANDBOX_RESPONSE_TOO_LARGE" ||
      code === "SANDBOX_REQUEST_ABORTED" ||
      code === "INVALID_TRANSPORT_RESPONSE"
    ) {
      throw error;
    }

    fail("SANDBOX_RESPONSE_READ_FAILED");

  } finally {
    if (finished) {
      try {
        reader.releaseLock();
      } catch {
        // Preserve the original result.
      }
    } else {
      // Do not await cancellation.
      // A custom stream may never resolve cancel().
      //
      // Cleanup is best effort and cannot delay
      // the primary request rejection.
      void Promise.resolve()
        .then(() => reader.cancel())
        .catch(() => {
          // Ignore cancellation failures.
        })
        .finally(() => {
          try {
            reader.releaseLock();
          } catch {
            // Ignore cleanup failures.
          }
        });
    }
  }
}

// =====================================================
// 6. EXPORTED HTTP TRANSPORT FACTORY
//
// IMPORTANT:
// Existing tests import this exact named export.
// Do not remove or rename this function.
// =====================================================

export function createSandboxFraudHttpTransport({
  fetchImpl,
} = {}) {
  if (typeof fetchImpl !== "function") {
    fail("SANDBOX_FETCH_INJECTION_REQUIRED");
  }

  return async function sandboxFraudHttpTransport(
    request
  ) {
    // -----------------------------------------------
    // Validate request before any network action.
    // -----------------------------------------------

    const url = validateRequest(request);

    let response;

    // -----------------------------------------------
    // Execute explicitly injected fetch.
    // -----------------------------------------------

    try {
      response = await fetchImpl(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization:
              request.headers.Authorization,
          },

          body: request.body,
          signal: request.signal,

          redirect: "error",
          credentials: "omit",
          cache: "no-store",

          mode: "cors",
          referrerPolicy: "no-referrer",
        }
      );
    } catch {
      if (request.signal.aborted) {
        fail("SANDBOX_REQUEST_ABORTED");
      }

      fail("SANDBOX_NETWORK_ERROR");
    }

    if (request.signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    // -----------------------------------------------
    // Validate response headers and status.
    // -----------------------------------------------

    validateResponse(response);

    // -----------------------------------------------
    // Read JSON with bounded streaming.
    // -----------------------------------------------

    const raw = await readBoundedResponse(
      response,
      request.signal
    );

    if (request.signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    // -----------------------------------------------
    // Parse JSON.
    // -----------------------------------------------

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      fail("INVALID_TRANSPORT_JSON");
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      fail("INVALID_TRANSPORT_JSON");
    }

    if (request.signal.aborted) {
      fail("SANDBOX_REQUEST_ABORTED");
    }

    return parsed;
  };
}
