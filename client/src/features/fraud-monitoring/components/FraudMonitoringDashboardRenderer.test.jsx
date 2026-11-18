import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import report from "../data/fixtures/fraudReportBackend.contract.json";
import FraudMonitoringDashboardRenderer from "./FraudMonitoringDashboardRenderer";

let forbidden;
beforeEach(() => {
  forbidden = vi.fn(() => { throw new Error("RENDERER_SIDE_EFFECT_FORBIDDEN"); });
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

function props(overrides = {}) {
  return {
    sessions: report.reports,
    metrics: { total: 2, integrity: 0, behavioral: 1, normal: 1 },
    selectedReport: null,
    gameFilter: "all",
    reviewFilter: "all",
    search: "",
    onGameFilterChange: vi.fn(),
    onReviewFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSelectSession: vi.fn(),
    onCloseDetails: vi.fn(),
    onResetFilters: vi.fn(),
    ...overrides,
  };
}

describe("Presentational fraud monitoring dashboard renderer", () => {
  it("renders supplied sessions and KPI values without filtering or recomputing them", () => {
    const input = props({
      metrics: { total: 12, integrity: 3, behavioral: 4, normal: 5 },
      gameFilter: "perfect-shot",
      reviewFilter: "integrity",
      search: "does-not-match",
    });
    const before = JSON.stringify(input);
    render(<FraudMonitoringDashboardRenderer {...input} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    for (const session of report.reports) {
      expect(within(screen.getByRole("table")).getByText(session.sessionId)).toBeTruthy();
    }
    for (const [title, count] of [["Sessions Analyzed", 12], ["Integrity Reviews", 3],
      ["Behavioral Warnings", 4], ["Normal Sessions", 5]]) {
      const card = screen.getByText(title, { selector: "p" }).parentElement;
      expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe(String(count));
    }
    expect(screen.getByRole("combobox", { name: "Filter game" }).value).toBe("perfect-shot");
    expect(screen.getByRole("combobox", { name: "Filter review status" }).value).toBe("integrity");
    expect(screen.getByRole("textbox", { name: "Search session or campaign" }).value).toBe("does-not-match");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("forwards control actions to explicit callbacks without performing side effects", () => {
    const input = props({ selectedReport: report.reports[0] });
    render(<FraudMonitoringDashboardRenderer {...input} />);
    for (const key of Object.keys(input).filter(key => key.startsWith("on"))) {
      expect(input[key]).not.toHaveBeenCalled();
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Filter game" }), { target: { value: "monkey" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter review status" }), { target: { value: "behavior" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search session or campaign" }), { target: { value: "x".repeat(201) } });
    const row = within(screen.getByRole("table")).getByText(report.reports[1].sessionId).closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "View Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(input.onGameFilterChange).toHaveBeenCalledExactlyOnceWith("monkey");
    expect(input.onReviewFilterChange).toHaveBeenCalledExactlyOnceWith("behavior");
    expect(input.onSearchChange).toHaveBeenCalledExactlyOnceWith("x".repeat(201));
    expect(input.onSelectSession).toHaveBeenCalledExactlyOnceWith(report.reports[1].sessionId);
    expect(input.onCloseDetails).toHaveBeenCalledTimes(1);
    expect(input.onResetFilters).toHaveBeenCalledTimes(1);
    // Visibility remains prop-driven until the container supplies a new value.
    expect(screen.getByRole("region", { name: "Session details" })).toBeTruthy();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("updates selected details from props while keeping assessment panels separate", () => {
    const input = props();
    const { rerender } = render(<FraudMonitoringDashboardRenderer {...input} />);
    expect(screen.queryByRole("region", { name: "Session details" })).toBeNull();
    rerender(<FraudMonitoringDashboardRenderer {...input} selectedReport={report.reports[1]} />);
    const details = screen.getByRole("region", { name: "Session details" });
    const integrity = within(details).getByRole("heading", { name: "Integrity Assessment V2" }).parentElement;
    const behavior = within(details).getByRole("heading", { name: "Behavioral Assessment V1" }).parentElement;
    expect(within(integrity).getByText("No Integrity Warning")).toBeTruthy();
    expect(within(behavior).getByText("Advisory Warning")).toBeTruthy();
    expect(within(behavior).getByText("highly regular tap cadence")).toBeTruthy();
    rerender(<FraudMonitoringDashboardRenderer {...input} selectedReport={null} />);
    expect(screen.queryByRole("region", { name: "Session details" })).toBeNull();
  });

  it("renders the existing empty table state without inventing data or actions", () => {
    render(<FraudMonitoringDashboardRenderer {...props({
      sessions: [], metrics: { total: 0, integrity: 0, behavioral: 0, normal: 0 },
    })} />);
    expect(screen.getByText("No matching sessions")).toBeTruthy();
    expect(screen.getByText("0 matching sessions")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "View Details" })).toBeNull();
    expect(screen.queryByRole("button", { name: /allocate|redeem|approve|reject/i })).toBeNull();
  });
});
