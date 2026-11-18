
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

function request() {
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
    signal: new AbortController().signal,
  };
}

function textOnlyResponse(raw) {
  return {
    status: 200,
    redirected: false,

    headers: {
      get(name) {
        if (name === "content-type") {
          return "application/json";
        }
        return null;
      },
    },

    text: vi.fn().mockResolvedValue(raw),
  };
}

describe("HNC Text-Only Mock Fallback Policy", () => {
  it("rejects text-only responses when fallback is disabled", async () => {
    const response = textOnlyResponse('{"ok":true}');

    const transport = createSandboxFraudHttpTransport({
      fetchImpl: vi.fn().mockResolvedValue(response),
      allowTextOnlyTestMocks: false,
    });

    await expect(
      transport(request())
    ).rejects.toThrow("INVALID_TRANSPORT_RESPONSE");

    expect(response.text).not.toHaveBeenCalled();
  });

  it("allows synthetic text-only responses in test mode", async () => {
    const response = textOnlyResponse(
      '{"result":"synthetic"}'
    );

    const transport = createSandboxFraudHttpTransport({
      fetchImpl: vi.fn().mockResolvedValue(response),
      allowTextOnlyTestMocks: true,
    });

    await expect(
      transport(request())
    ).resolves.toEqual({
      result: "synthetic",
    });

    expect(response.text).toHaveBeenCalledOnce();
  });

  it("rejects oversized synthetic text responses", async () => {
    const response = textOnlyResponse(
      "a".repeat(262145)
    );

    const transport = createSandboxFraudHttpTransport({
      fetchImpl: vi.fn().mockResolvedValue(response),
      allowTextOnlyTestMocks: true,
    });

    await expect(
      transport(request())
    ).rejects.toThrow("SANDBOX_RESPONSE_TOO_LARGE");
  });

  it("rejects non-streaming responses without text()", async () => {
    const response = {
      status: 200,
      redirected: false,

      headers: {
        get(name) {
          if (name.toLowerCase() === "content-type") {
            return "application/json";
          }

          // Content-Length is absent.
          return null;
        },
      },
    };

    const transport = createSandboxFraudHttpTransport({
      fetchImpl: vi.fn().mockResolvedValue(response),
      allowTextOnlyTestMocks: false,
    });

    await expect(
      transport(request())
    ).rejects.toThrow("INVALID_TRANSPORT_RESPONSE");
  });
});
