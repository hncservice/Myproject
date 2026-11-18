
import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createSandboxFraudHttpTransport,
} from "./fraudReportSandboxTransport";

const ID = "507f1f77bcf86cd799439011";

function makeRequest(signal) {
  return {
    url: "http://127.0.0.1:8787/sandbox/fraud-report",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer synthetic-test-token",
    },
    body: JSON.stringify({
      sessionIds: [ID],
      limit: 1,
    }),
    signal,
    redirect: "error",
    credentials: "omit",
    cache: "no-store",
  };
}

function makeResponse(stream) {
  return {
    status: 200,
    redirected: false,
    body: stream,
    headers: {
      get(name) {
        if (name === "content-type") {
          return "application/json";
        }

        return null;
      },
    },
  };
}

function makeTransport(response) {
  return createSandboxFraudHttpTransport({
    fetchImpl: vi.fn().mockResolvedValue(response),
  });
}

describe("HNC Streaming Cancellation Safety", () => {
  it("rejects an indefinitely stalled read after abort", async () => {
    const controller = new AbortController();

    let readStarted;

    const started = new Promise((resolve) => {
      readStarted = resolve;
    });

    const stream = new ReadableStream({
      pull() {
        readStarted();
        // Intentionally never enqueue or close.
      },
    });

    const transport = makeTransport(
      makeResponse(stream)
    );

    const pending = transport(
      makeRequest(controller.signal)
    );

    await started;

    controller.abort();

    await expect(pending).rejects.toThrow(
      "SANDBOX_REQUEST_ABORTED"
    );
  });

  it("does not wait for a stalled cancel promise", async () => {
    const controller = new AbortController();

    let readStarted;

    const started = new Promise((resolve) => {
      readStarted = resolve;
    });

    const reader = {
      read: vi.fn(() => {
        readStarted();
        return new Promise(() => {});
      }),

      cancel: vi.fn(
        () => new Promise(() => {})
      ),

      releaseLock: vi.fn(),
    };

    const fakeStream = {
      getReader: vi.fn(() => reader),
    };

    const transport = makeTransport(
      makeResponse(fakeStream)
    );

    const pending = transport(
      makeRequest(controller.signal)
    );

    await started;
    controller.abort();

    await expect(pending).rejects.toThrow(
      "SANDBOX_REQUEST_ABORTED"
    );

    // Allow the asynchronous cleanup microtasks
    // to run without waiting for cancel to finish.
    await Promise.resolve();
    await Promise.resolve();

    expect(reader.cancel).toHaveBeenCalledOnce();
  });

  it("rejects aborted requests before fetch", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest(controller.signal))
    ).rejects.toThrow("SANDBOX_REQUEST_ABORTED");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
