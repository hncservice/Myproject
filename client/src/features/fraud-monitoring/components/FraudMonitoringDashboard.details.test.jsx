
import {
  describe,
  it,
  expect,
  afterEach,
  vi,
} from "vitest";

import {
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import FraudMonitoringDashboard from "./FraudMonitoringDashboard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function sessionRow(sessionId) {
  return screen.getByText(sessionId).closest("tr");
}

async function openDetails(sessionId) {
  const user = userEvent.setup();

  const row = sessionRow(sessionId);

  await user.click(
    within(row).getByRole("button", {
      name: "View Details",
    })
  );

  return screen.getByRole("region", {
    name: "Session details",
  });
}

describe("HNC Fraud Dashboard - Session Details", () => {
  it("opens the selected session details", async () => {
    render(<FraudMonitoringDashboard />);

    const details = await openDetails("SANDBOX-M001");

    expect(within(details).getByText("SANDBOX-M001"))
      .toBeTruthy();

    expect(within(details).getByText("hnc-sandbox"))
      .toBeTruthy();
  });

  it("shows advisory behavioral warnings separately", async () => {
    render(<FraudMonitoringDashboard />);

    const details = await openDetails("SANDBOX-M002");

    expect(
      within(details).getByText(
        "Behavioral Assessment V1"
      )
    ).toBeTruthy();

    expect(
      within(details).getByText(
        "highly regular tap cadence"
      )
    ).toBeTruthy();

    expect(
      within(details).getByText(
        "No Integrity Warning"
      )
    ).toBeTruthy();
  });

  it("shows integrity review reasons", async () => {
    render(<FraudMonitoringDashboard />);

    const details = await openDetails("SANDBOX-M003");

    expect(
      within(details).getByText("Integrity Assessment V2")
    ).toBeTruthy();

    expect(
      within(details).getByText("monkey score mismatch")
    ).toBeTruthy();

    expect(
      within(details).getByText("Review Required")
    ).toBeTruthy();
  });

  it("closes session details", async () => {
    render(<FraudMonitoringDashboard />);

    const user = userEvent.setup();

    await openDetails("SANDBOX-M001");

    await user.click(
      screen.getByRole("button", {
        name: "Close Details",
      })
    );

    expect(
      screen.queryByRole("region", {
        name: "Session details",
      })
    ).toBeNull();
  });

  it("does not show details when the selected session is filtered out", async () => {
    render(<FraudMonitoringDashboard />);

    await openDetails("SANDBOX-M002");

    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter game",
      }),
      "perfect-shot"
    );

    expect(
      screen.queryByRole("region", {
        name: "Session details",
      })
    ).toBeNull();
  });

  it("does not perform network requests when opening details", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("NETWORK_BLOCKED");
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FraudMonitoringDashboard />);

    await openDetails("SANDBOX-M002");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
