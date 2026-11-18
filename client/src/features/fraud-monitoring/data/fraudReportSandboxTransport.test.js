
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

function makeRequest(overrides = {}) {
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
      sessionIds: [ID],
      limit: 1,
    }),
    signal: new AbortController().signal,
    ...overrides,
  };
}

function makeResponse({
  status = 200,
  body = { result: "synthetic" },
  redirected = false,
  contentType = "application/json",
  contentLength = null,
} = {}) {
  const raw = JSON.stringify(body);

  return {
    status,
    redirected,
    headers: {
      get(name) {
        if (name === "content-type") {
          return contentType;
        }

        if (name === "content-length") {
          return contentLength;
        }

        return null;
      },
    },
    text: vi.fn().mockResolvedValue(raw),
  };
}

describe("HNC Sandbox Transport Isolation", () => {
  it("requires an injected fetch implementation", () => {
    expect(() =>
      createSandboxFraudHttpTransport()
    ).toThrow("SANDBOX_FETCH_INJECTION_REQUIRED");
  });

  it("rejects external domains before network access", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          url:
            "https://api.hotncool.qa/sandbox/fraud-report",
        })
      )
    ).rejects.toThrow(
      "UNTRUSTED_TRANSPORT_DESTINATION"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects misleading localhost hostnames", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          url:
            "http://localhost.evil.example:8787/sandbox/fraud-report",
        })
      )
    ).rejects.toThrow(
      "UNTRUSTED_TRANSPORT_DESTINATION"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unexpected URL query parameters", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          url:
            "http://127.0.0.1:8787/sandbox/fraud-report?redirect=1",
        })
      )
    ).rejects.toThrow(
      "UNTRUSTED_TRANSPORT_DESTINATION"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe credential settings", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          credentials: "include",
        })
      )
    ).rejects.toThrow(
      "INVALID_TRANSPORT_REQUEST"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects already-aborted requests", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          signal: controller.signal,
        })
      )
    ).rejects.toThrow("SANDBOX_REQUEST_ABORTED");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes safe options to mocked fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse()
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    const result = await transport(makeRequest());

    expect(result).toEqual({
      result: "synthetic",
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] =
      fetchMock.mock.calls[0];

    expect(url).toBe(
      "http://127.0.0.1:8787/sandbox/fraud-report"
    );

    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
    expect(options.mode).toBe("cors");
    expect(options.referrerPolicy).toBe("no-referrer");
    expect(options.cache).toBe("no-store");
  });

  it("rejects HTTP redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        status: 302,
        redirected: true,
      })
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow(
      "SANDBOX_REDIRECT_REJECTED"
    );
  });

  it("rejects authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        status: 401,
      })
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow(
      "SANDBOX_AUTHORIZATION_FAILED"
    );
  });

  it("rejects non-JSON content types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        contentType: "text/html",
      })
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow(
      "INVALID_TRANSPORT_CONTENT_TYPE"
    );
  });

  it("rejects oversized declared responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        contentLength: "9999999",
      })
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow(
      "SANDBOX_RESPONSE_TOO_LARGE"
    );
  });

  it("rejects malformed JSON responses", async () => {
    const response = makeResponse();

    response.text = vi.fn().mockResolvedValue(
      "{invalid-json"
    );

    const fetchMock = vi.fn().mockResolvedValue(
      response
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow("INVALID_TRANSPORT_JSON");
  });

  it("sanitizes network errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new Error("synthetic-token-in-error")
    );

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(makeRequest())
    ).rejects.toThrow("SANDBOX_NETWORK_ERROR");
  });

  it("rejects invalid session request bodies", async () => {
    const fetchMock = vi.fn();

    const transport =
      createSandboxFraudHttpTransport({
        fetchImpl: fetchMock,
      });

    await expect(
      transport(
        makeRequest({
          body: JSON.stringify({
            sessionIds: ["invalid"],
            limit: 1,
          }),
        })
      )
    ).rejects.toThrow("INVALID_TRANSPORT_BODY");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
