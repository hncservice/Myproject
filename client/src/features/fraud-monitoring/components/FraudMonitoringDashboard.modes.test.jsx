import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import report from "../data/fixtures/fraudReportBackend.contract.json";
import FraudMonitoringDashboard from "./FraudMonitoringDashboard";

const mockIds = ["SANDBOX-M001", "SANDBOX-M002", "SANDBOX-M003", "SANDBOX-P001"];
const firstId = report.reports[0].sessionId;
const secondId = report.reports[1].sessionId;
const table = () => screen.getByRole("table");
const details = () => screen.queryByRole("region", { name: "Session details" });
const game = () => screen.getByRole("combobox", { name: "Filter game" });
const review = () => screen.getByRole("combobox", { name: "Filter review status" });
const search = () => screen.getByRole("textbox", { name: "Search session or campaign" });
const visibleIds = () => within(table()).queryAllByRole("button", { name: "View Details" })
  .map(button => within(button.closest("tr")).getAllByRole("cell")[0].textContent);
const open = id => fireEvent.click(within(within(table()).getByText(id).closest("tr"))
  .getByRole("button", { name: "View Details" }));
const mountValidated = () => render(<FraudMonitoringDashboard dataMode="validated-offline" report={report} />);
const expectDefaults = () => {
  expect(game().value).toBe("all");
  expect(review().value).toBe("all");
  expect(search().value).toBe("");
  expect(details()).toBeNull();
};
const expectEmpty = () => {
  expect(visibleIds()).toEqual([]);
  expect(details()).toBeNull();
  expect(screen.getByText("No matching sessions")).toBeTruthy();
  for (const title of ["Sessions Analyzed", "Integrity Reviews", "Behavioral Warnings", "Normal Sessions"]) {
    expect(within(screen.getByText(title, { selector: "p" }).parentElement)
      .getByRole("heading", { level: 2 }).textContent).toBe("0");
  }
};

let forbidden;
beforeEach(() => {
  forbidden = vi.fn(() => { throw new Error("OFFLINE_MODE_SIDE_EFFECT_FORBIDDEN"); });
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "allocatePrize", "redeemPrize"]) {
    vi.stubGlobal(name, forbidden);
  }
  for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
    vi.spyOn(Storage.prototype, method).mockImplementation(forbidden);
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

describe("Explicit fraud dashboard offline data modes", () => {
  it("preserves identical default and explicit mock markup", () => {
    const { container, rerender } = render(<FraudMonitoringDashboard />);
    const initialMarkup = container.innerHTML;
    expect(visibleIds()).toEqual(mockIds);
    rerender(<FraudMonitoringDashboard dataMode="mock" />);
    expect(container.innerHTML).toBe(initialMarkup);
    expect(screen.getByText("SANDBOX · MOCK DATA")).toBeTruthy();
  });

  it("ignores report-only input and never inspects reports in mock mode", () => {
    const read = vi.fn(() => { throw new Error("REPORT_READ_FORBIDDEN"); });
    const { rerender } = render(<FraudMonitoringDashboard report={report} />);
    expect(visibleIds()).toEqual(mockIds);
    rerender(<FraudMonitoringDashboard dataMode="mock" report={new Proxy({}, { get: read })} />);
    expect(visibleIds()).toEqual(mockIds);
    expect(read).not.toHaveBeenCalled();
  });

  it("renders disabled mode empty without inspecting supplied reports", () => {
    const read = vi.fn(() => { throw new Error("REPORT_READ_FORBIDDEN"); });
    render(<FraudMonitoringDashboard dataMode="disabled" report={new Proxy({}, { get: read })} />);
    expectEmpty();
    expect(screen.getByText("OFFLINE · DISABLED")).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it("renders only validated sessions after explicit offline opt-in", () => {
    mountValidated();
    expect(visibleIds()).toEqual([firstId, secondId]);
    expect(screen.getByText("VALIDATED SYNTHETIC OFFLINE DATA")).toBeTruthy();
    expect(screen.getByText(/Validated synthetic offline data only; not live data/)).toBeTruthy();
    expect(screen.queryByText("SANDBOX · MOCK DATA")).toBeNull();
    expect(screen.queryByText(/Mock data only\./)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    mockIds.forEach(id => expect(screen.queryByText(id)).toBeNull());
  });

  it("fails closed for unknown modes without falling back to mocks", () => {
    const { rerender, container } = render(<FraudMonitoringDashboard dataMode="unexpected" report={report} />);
    expectEmpty();
    expect(screen.getByRole("alert").textContent).toContain("Unknown dashboard data mode");
    for (const mode of [null, false, "<img src=x onerror=alert(1)>"]) {
      rerender(<FraudMonitoringDashboard dataMode={mode} report={report} />);
      expectEmpty();
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(container.querySelector("img")).toBeNull();
    }
  });

  it("fails closed for missing or invalid validated reports", () => {
    const { rerender } = render(<FraudMonitoringDashboard dataMode="validated-offline" />);
    expectEmpty();
    expect(screen.getByRole("alert").textContent).toContain("Invalid synthetic report");
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={{ ...report, prizeAllocated: true }} />);
    expectEmpty();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("replaces valid reports and resets controls and selected details", () => {
    const { rerender } = mountValidated();
    fireEvent.change(game(), { target: { value: "monkey" } });
    fireEvent.change(review(), { target: { value: "normal" } });
    fireEvent.change(search(), { target: { value: firstId } });
    open(firstId);
    expect(within(details()).getByText(firstId)).toBeTruthy();
    const replacement = {
      ...report,
      campaignId: "replacement-synthetic-campaign",
      reports: report.reports.map((session, index) => ({
        ...session,
        sessionId: index === 0 ? "aaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbb",
        campaignId: "replacement-synthetic-campaign",
        gameId: "perfect-shot",
      })),
    };
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={replacement} />);
    expectDefaults();
    expect(visibleIds()).toEqual(["aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"]);
    expect(screen.queryByText(firstId)).toBeNull();
    expect(screen.queryByText(secondId)).toBeNull();
    open("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(within(details()).getByText("replacement-synthetic-campaign")).toBeTruthy();
  });

  it("clears selection even when a replacement report reuses the same session IDs", () => {
    const { rerender } = mountValidated();
    open(firstId);
    const replacement = {
      ...report,
      reports: report.reports.map(session => ({ ...session, status: "replacement-status" })),
    };
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={replacement} />);
    expectDefaults();
    expect(visibleIds()).toEqual([firstId, secondId]);
    open(firstId);
    expect(within(details()).getByText("replacement-status")).toBeTruthy();
  });

  it("exposes neither prior details nor unsafe text after an invalid replacement", () => {
    const { rerender, container } = mountValidated();
    open(secondId);
    expect(within(details()).getByText(secondId)).toBeTruthy();
    const marker = "UNSAFE_REPLACEMENT_NOT_FOR_DISPLAY";
    const invalid = {
      ...report,
      prizeAllocated: true,
      campaignId: marker,
      reports: report.reports.map(session => ({ ...session, campaignId: marker, status: marker })),
    };
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={invalid} />);
    expectEmpty();
    expectDefaults();
    expect(screen.getByRole("alert")).toBeTruthy();
    for (const text of [firstId, secondId, report.campaignId, marker, "highly regular tap cadence"]) {
      expect(container.textContent).not.toContain(text);
    }
  });

  it("resets mock state when switching to validated mode and back", () => {
    const { rerender } = render(<FraudMonitoringDashboard />);
    fireEvent.change(game(), { target: { value: "monkey" } });
    fireEvent.change(search(), { target: { value: "SANDBOX-M002" } });
    open("SANDBOX-M002");
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={report} />);
    expectDefaults();
    expect(visibleIds()).toEqual([firstId, secondId]);
    open(secondId);
    fireEvent.change(review(), { target: { value: "behavior" } });
    rerender(<FraudMonitoringDashboard dataMode="mock" />);
    expectDefaults();
    expect(visibleIds()).toEqual(mockIds);
    expect(screen.getByText("SANDBOX · MOCK DATA")).toBeTruthy();
  });

  it("clears visible data on disabling and starts fresh when reenabling", () => {
    const { rerender } = mountValidated();
    open(secondId);
    fireEvent.change(search(), { target: { value: secondId } });
    rerender(<FraudMonitoringDashboard dataMode="disabled" report={report} />);
    expectEmpty();
    expectDefaults();
    expect(screen.queryByText(secondId)).toBeNull();
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={report} />);
    expectDefaults();
    expect(visibleIds()).toEqual([firstId, secondId]);
  });

  it("drops old details when changing from validated to an unknown mode", () => {
    const { rerender } = mountValidated();
    open(firstId);
    rerender(<FraudMonitoringDashboard dataMode="unknown" report={report} />);
    expectEmpty();
    expectDefaults();
    expect(screen.getByRole("alert").textContent).toContain("Unknown dashboard data mode");
  });

  it("preserves validated filters and selection on ordinary same-input rerenders", () => {
    const { rerender } = mountValidated();
    fireEvent.change(review(), { target: { value: "behavior" } });
    fireEvent.change(search(), { target: { value: secondId } });
    open(secondId);
    rerender(<FraudMonitoringDashboard dataMode="validated-offline" report={report} />);
    expect(review().value).toBe("behavior");
    expect(search().value).toBe(secondId);
    expect(visibleIds()).toEqual([secondId]);
    expect(within(details()).getByText(secondId)).toBeTruthy();
  });

  it("keeps validated controls and details unchanged after an invalid search update", () => {
    mountValidated();
    fireEvent.change(search(), { target: { value: firstId } });
    open(firstId);
    fireEvent.change(search(), { target: { value: "x".repeat(201) } });
    expect(screen.getByRole("alert").textContent).toContain("Previous view preserved");
    expect(search().value).toBe(firstId);
    expect(visibleIds()).toEqual([firstId]);
    expect(within(details()).getByText(firstId)).toBeTruthy();
  });

  it("keeps Integrity V2 separate from Behavioral V1 without enforcement actions", () => {
    const separated = {
      ...report,
      reports: report.reports.map((session, index) => index === 0 ? {
        ...session,
        integrity: { ...session.integrity, reviewRequired: true, riskReasons: ["SYNTHETIC_INTEGRITY_WARNING"] },
        preliminaryReviewRequired: true,
      } : session),
    };
    render(<FraudMonitoringDashboard dataMode="validated-offline" report={separated} />);
    open(firstId);
    expect(within(details()).getByRole("heading", { name: "Integrity Assessment V2" })).toBeTruthy();
    expect(within(details()).getByText("Review Required")).toBeTruthy();
    expect(within(details()).getByText("No behavioral warnings reported.")).toBeTruthy();
    open(secondId);
    expect(within(details()).getByRole("heading", { name: "Behavioral Assessment V1" })).toBeTruthy();
    expect(within(details()).getByText("No Integrity Warning")).toBeTruthy();
    expect(within(details()).getByText("Advisory Warning")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve|reject|allocate|redeem|award/i })).toBeNull();
  });

  it("renders report text safely without creating HTML nodes", () => {
    const synthetic = {
      ...report,
      reports: report.reports.map(session => ({ ...session, status: "<img src=x onerror=alert(1)>" })),
    };
    const { container } = render(<FraudMonitoringDashboard dataMode="validated-offline" report={synthetic} />);
    open(firstId);
    expect(within(details()).getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("makes no network storage or prize calls across interactions and mode changes", async () => {
    const before = JSON.stringify(report);
    const { rerender } = mountValidated();
    const user = userEvent.setup();
    open(secondId);
    await user.selectOptions(review(), "behavior");
    await user.type(search(), secondId);
    await user.click(screen.getByRole("button", { name: "Reset Filters" }));
    expectDefaults();
    rerender(<FraudMonitoringDashboard dataMode="mock" />);
    open("SANDBOX-M002");
    rerender(<FraudMonitoringDashboard dataMode="disabled" />);
    expectEmpty();
    expect(screen.queryByRole("button", { name: /approve|reject|allocate|redeem|award/i })).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).toBe(before);
  });
});
