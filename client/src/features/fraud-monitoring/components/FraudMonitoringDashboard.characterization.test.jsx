import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FraudMonitoringDashboard from "./FraudMonitoringDashboard";

const mockIds = ["SANDBOX-M001", "SANDBOX-M002", "SANDBOX-M003", "SANDBOX-P001"];
const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowFor = id => within(screen.getByRole("table")).getByRole("cell", { name: id }).closest("tr");
const details = () => screen.queryByRole("region", { name: "Session details" });
const gameFilter = () => screen.getByRole("combobox", { name: "Filter game" });
const search = () => screen.getByRole("textbox", { name: "Search session or campaign" });

function expectKpi(title, count) {
  const card = screen.getByText(title, { selector: "p" }).parentElement;
  expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe(String(count));
}

async function selectSession(user, id) {
  await user.click(within(rowFor(id)).getByRole("button", { name: "View Details" }));
}

let forbidden;
beforeEach(() => {
  forbidden = vi.fn(() => { throw new Error("OFFLINE_CHARACTERIZATION_SIDE_EFFECT"); });
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "allocatePrize", "redeemPrize"]) {
    vi.stubGlobal(name, forbidden);
  }
});

afterEach(() => {
  try {
    cleanup();
    expect(forbidden).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

describe("Mock fraud dashboard behavior preservation", () => {
  it("displays exactly four default mock sessions", () => {
    render(<FraudMonitoringDashboard />);
    expect(rows()).toHaveLength(4);
    expect(within(screen.getByRole("table")).getAllByRole("button", { name: "View Details" }))
      .toHaveLength(4);
    expect(screen.getByText("4 matching sessions")).toBeTruthy();
    expect(screen.getByText("SANDBOX · MOCK DATA")).toBeTruthy();
  });

  it("preserves the four default KPI counts", () => {
    render(<FraudMonitoringDashboard />);
    expectKpi("Sessions Analyzed", 4);
    expectKpi("Integrity Reviews", 1);
    expectKpi("Behavioral Warnings", 1);
    expectKpi("Normal Sessions", 2);
  });

  it("preserves the exact mock session identifiers and their order", () => {
    render(<FraudMonitoringDashboard />);
    expect(rows().map(row => within(row).getAllByRole("cell")[0].textContent))
      .toEqual(mockIds);
  });

  it("preserves Monkey and Perfect Shot display and filter labels", () => {
    render(<FraudMonitoringDashboard />);
    expect(rows().map(row => within(row).getAllByRole("cell")[1].textContent))
      .toEqual(["Whack the Monkey", "Whack the Monkey", "Whack the Monkey", "Perfect Shot"]);
    expect(within(gameFilter()).getByRole("option", { name: "Monkey", exact: true }).value)
      .toBe("monkey");
    expect(within(gameFilter()).getByRole("option", { name: "Perfect Shot", exact: true }).value)
      .toBe("perfect-shot");
  });

  it("accepts searches longer than 200 characters without throwing or truncating", () => {
    render(<FraudMonitoringDashboard />);
    const longQuery = "x".repeat(201);
    expect(() => fireEvent.change(search(), { target: { value: longQuery } })).not.toThrow();
    expect(search().value).toBe(longQuery);
    expect(screen.getByText("No matching sessions")).toBeTruthy();
    expectKpi("Sessions Analyzed", 0);
    const paddedId = " ".repeat(201) + "sandbox-m002";
    expect(() => fireEvent.change(search(), { target: { value: paddedId } })).not.toThrow();
    expect(search().value).toBe(paddedId);
    expect(rows()).toHaveLength(1);
    expect(within(rowFor("SANDBOX-M002")).getByText("SANDBOX-M002")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens details for a selected mock identifier", async () => {
    render(<FraudMonitoringDashboard />);
    expect(details()).toBeNull();
    await selectSession(userEvent.setup(), "SANDBOX-M001");
    expect(within(details()).getByText("SANDBOX-M001")).toBeTruthy();
    expect(within(details()).getByText("hnc-sandbox")).toBeTruthy();
    expect(within(details()).getByRole("button", { name: "Close Details" })).toBeTruthy();
  });

  it("hides details when the selected session is filtered out", async () => {
    render(<FraudMonitoringDashboard />);
    const user = userEvent.setup();
    await selectSession(user, "SANDBOX-M002");
    expect(within(details()).getByText("SANDBOX-M002")).toBeTruthy();
    await user.selectOptions(gameFilter(), "perfect-shot");
    expect(details()).toBeNull();
    expect(screen.queryByText("SANDBOX-M002")).toBeNull();
    expect(rows()).toHaveLength(1);
    expect(within(rowFor("SANDBOX-P001")).getByText("SANDBOX-P001")).toBeTruthy();
  });

  it("restores previously selected details when filters are restored without reset", async () => {
    render(<FraudMonitoringDashboard />);
    const user = userEvent.setup();
    await selectSession(user, "SANDBOX-M002");
    const selectedDetails = details().textContent;
    await user.selectOptions(gameFilter(), "perfect-shot");
    expect(details()).toBeNull();
    // Changing the filter back must preserve legacy mock selection semantics.
    // Reset Filters intentionally clears selection and must not be used here.
    await user.selectOptions(gameFilter(), "all");
    expect(rows()).toHaveLength(4);
    expect(details().textContent).toBe(selectedDetails);
    expect(within(details()).getByText("SANDBOX-M002")).toBeTruthy();
  });

  it("keeps Integrity V2 and Behavioral V1 findings independent", async () => {
    render(<FraudMonitoringDashboard />);
    const user = userEvent.setup();
    const behaviorCells = within(rowFor("SANDBOX-M002")).getAllByRole("cell");
    expect(behaviorCells[3].textContent).toBe("No Integrity Warning");
    expect(behaviorCells[4].textContent).toBe("Advisory Warning");
    const integrityCells = within(rowFor("SANDBOX-M003")).getAllByRole("cell");
    expect(integrityCells[3].textContent).toBe("Review Required");
    expect(integrityCells[4].textContent).toBe("No Warning");

    await selectSession(user, "SANDBOX-M002");
    const integrityPanel = within(details()).getByRole("heading", { name: "Integrity Assessment V2" }).parentElement;
    const behaviorPanel = within(details()).getByRole("heading", { name: "Behavioral Assessment V1" }).parentElement;
    expect(within(integrityPanel).getByText("No integrity issues reported.")).toBeTruthy();
    expect(within(behaviorPanel).getByText("Advisory Warning")).toBeTruthy();
    expect(within(behaviorPanel).getByText("highly regular tap cadence")).toBeTruthy();
    expect(behaviorPanel.textContent).toContain("Behavioral warnings cannot automatically reject a player or allocate a prize.");

    await selectSession(user, "SANDBOX-M003");
    expect(within(details()).getByText("monkey score mismatch")).toBeTruthy();
    expect(within(details()).getByText("No behavioral warnings reported.")).toBeTruthy();
  });

  it("makes no network requests throughout filtering searching selection and reset", async () => {
    render(<FraudMonitoringDashboard />);
    const user = userEvent.setup();
    await selectSession(user, "SANDBOX-M002");
    await user.selectOptions(gameFilter(), "monkey");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter review status" }), "behavior");
    await user.type(search(), "sandbox-m002");
    await user.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(rows()).toHaveLength(4);
    expect(details()).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("offers only monitoring controls and never triggers prize-related actions", async () => {
    render(<FraudMonitoringDashboard />);
    const user = userEvent.setup();
    await selectSession(user, "SANDBOX-M003");
    expect(screen.queryByRole("button", { name: /approve|reject|allocate|redeem|award|claim/i })).toBeNull();
    expect(screen.getAllByRole("button").every(button =>
      ["View Details", "Close Details", "Reset Filters"].includes(button.textContent)))
      .toBe(true);
    await user.click(screen.getByRole("button", { name: "Close Details" }));
    await user.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(forbidden).not.toHaveBeenCalled();
  });
});
