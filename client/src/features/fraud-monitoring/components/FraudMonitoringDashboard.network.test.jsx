
import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from "vitest";

import {
  render,
  screen,
  cleanup,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import FraudMonitoringDashboard from "./FraudMonitoringDashboard";

// =====================================================
// NETWORK ISOLATION TEST
// HNC Game & Prize Platform
// Step 15R.22D
// =====================================================

let networkMocks = [];

function blockNetwork() {
  const fetchMock = vi.fn(() => {
    throw new Error("NETWORK_BLOCKED_FETCH");
  });

  const xhrMock = vi.fn(() => {
    throw new Error("NETWORK_BLOCKED_XHR");
  });

  const websocketMock = vi.fn(() => {
    throw new Error("NETWORK_BLOCKED_WEBSOCKET");
  });

  const eventSourceMock = vi.fn(() => {
    throw new Error("NETWORK_BLOCKED_EVENTSOURCE");
  });

  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("XMLHttpRequest", xhrMock);
  vi.stubGlobal("WebSocket", websocketMock);
  vi.stubGlobal("EventSource", eventSourceMock);

  networkMocks = [
    fetchMock,
    xhrMock,
    websocketMock,
    eventSourceMock,
  ];
}

function expectNoNetworkRequests() {
  for (const mock of networkMocks) {
    expect(mock).not.toHaveBeenCalled();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  networkMocks = [];
});

describe("HNC Fraud Dashboard - Network Isolation", () => {

  // TEST 1
  it("renders without network requests", () => {
    blockNetwork();

    render(<FraudMonitoringDashboard />);

    expect(
      screen.getByText("SANDBOX-M001")
    ).toBeTruthy();

    expectNoNetworkRequests();
  });

  // TEST 2
  it("filters sessions without network requests", async () => {
    blockNetwork();

    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter game",
      }),
      "monkey"
    );

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter review status",
      }),
      "behavior"
    );

    expect(
      screen.getByText("SANDBOX-M002")
    ).toBeTruthy();

    expectNoNetworkRequests();
  });

  // TEST 3
  it("searches without network requests", async () => {
    blockNetwork();

    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.type(
      screen.getByRole("textbox", {
        name: "Search session or campaign",
      }),
      "SANDBOX-P001"
    );

    expect(
      screen.getByText("SANDBOX-P001")
    ).toBeTruthy();

    expectNoNetworkRequests();
  });

  // TEST 4
  it("clears filters without network requests", async () => {
    blockNetwork();

    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    const gameFilter = screen.getByRole("combobox", {
      name: "Filter game",
    });

    const reviewFilter = screen.getByRole("combobox", {
      name: "Filter review status",
    });

    await user.selectOptions(gameFilter, "perfect-shot");
    await user.selectOptions(reviewFilter, "normal");

    expect(
      screen.getAllByRole("row")
    ).toHaveLength(2);

    await user.selectOptions(gameFilter, "all");
    await user.selectOptions(reviewFilter, "all");

    expect(
      screen.getAllByRole("row")
    ).toHaveLength(5);

    expectNoNetworkRequests();
  });

  // TEST 5
  it("contains no prize decision controls", () => {
    blockNetwork();

    render(<FraudMonitoringDashboard />);

    expect(
      screen.queryByRole("button", {
        name: /approve|reject|allocate|redeem|award/i,
      })
    ).toBeNull();

    expectNoNetworkRequests();
  });

});
