
import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createSandboxFraudHttpTransport,
} from "./fraudReportSandboxTransport";

const SESSION_ID = "507f1f77bcf86cd799439011";

const MAX_BYTES = 262144;

function makeRequest(signal = new AbortController().signal) {
  return {
    url: "http://127.0.0.1:8787/sandbox/fraud-report",
    method: "POST",
    redirect: "error",
    credentials: "omit",
    cache: "no-store",

    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer synthetic-test-token",
    },

    body: JSON.stringify({
      sessionIds: [SESSION_ID],
      limit: 1,
    }),

    signal,
  };
}

function streamFromChunks(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      controller.close();
    },
  });
}

function makeResponse(body, contentLength = null) {
  return {
    status: 200,
    redirected: false,
    body,

    headers: {
      get(name) {
        if (name === "content-type") {
          return "application/json";
        }

        if (name === "content-length") {
          return contentLength;
        }

        return null;
      },
    },

    text: vi.fn(() => {
      throw new Error("text() must not be called");
    }),
  };
}

function createTransport(response) {
  const fetchMock = vi.fn().mockResolvedValue(
    response
  );

  return {
    fetchMock,
    transport: createSandboxFraudHttpTransport({
      fetchImpl: fetchMock,
    }),
  };
}

describe("HNC Fraud Report Bounded Streaming", () => {
  it("parses a valid streamed JSON response", async () => {
    const encoder = new TextEncoder();

    const stream = streamFromChunks([
      encoder.encode('{"result":'),
      encoder.encode('"synthetic"}'),
    ]);

    const response = makeResponse(stream);
    const { transport } = createTransport(response);

    const result = await transport(makeRequest());

    expect(result).toEqual({
      result: "synthetic",
    });

    expect(response.text).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed response", async () => {
    const encoder = new TextEncoder();

    const stream = streamFromChunks([
      encoder.encode("a".repeat(MAX_BYTES)),
      encoder.encode("b"),
    ]);

    const { transport } = createTransport(
      makeResponse(stream)
    );

    await expect(
      transport(makeRequest())
    ).rejects.toThrow("SANDBOX_RESPONSE_TOO_LARGE");
  });

  it("rejects oversized declared content length", async () => {
    const encoder = new TextEncoder();

    const stream = streamFromChunks([
      encoder.encode('{"ok":true}'),
    ]);

    const response = makeResponse(
      stream,
      String(MAX_BYTES + 1)
    );

    const { transport } = createTransport(response);

    await expect(
      transport(makeRequest())
    ).rejects.toThrow("SANDBOX_RESPONSE_TOO_LARGE");

    expect(response.text).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON from a stream", async () => {
    const encoder = new TextEncoder();

    const stream = streamFromChunks([
      encoder.encode("{invalid-json"),
    ]);

    const { transport } = createTransport(
      makeResponse(stream)
    );

    await expect(
      transport(makeRequest())
    ).rejects.toThrow("INVALID_TRANSPORT_JSON");
  });

  it("rejects invalid UTF-8 bytes", async () => {
    const stream = streamFromChunks([
      new Uint8Array([0xff, 0xfe]),
    ]);

    const { transport } = createTransport(
      makeResponse(stream)
    );

    await expect(
      transport(makeRequest())
    ).rejects.toThrow(
      "SANDBOX_RESPONSE_READ_FAILED"
    );
  });

  it("rejects an aborted stream request", async () => {
    const controller = new AbortController();

    const stream = new ReadableStream({
      start(streamController) {
        controller.abort();
        streamController.enqueue(
          new TextEncoder().encode('{"ok":true}')
        );
        streamController.close();
      },
    });

    const { transport, fetchMock } = createTransport(
      makeResponse(stream)
    );

    await expect(
      transport(makeRequest(controller.signal))
    ).rejects.toThrow("SANDBOX_REQUEST_ABORTED");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
