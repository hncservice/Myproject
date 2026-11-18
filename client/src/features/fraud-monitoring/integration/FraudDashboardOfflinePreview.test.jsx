import React, { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import report from "../data/fixtures/fraudReportBackend.contract.json";
import { validateFraudReportResponse } from "../data/fraudReportValidator";
import FraudDashboardOfflinePreview from "./FraudDashboardOfflinePreview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const firstId = report.reports[0].sessionId;
const secondId = report.reports[1].sessionId;
const sessions = () => screen.getByRole("list", { name: "Sessions" });
const details = () => screen.getByRole("region", { name: "Selected session details" });
const game = () => screen.getByRole("combobox", { name: "Filter game" });
const review = () => screen.getByRole("combobox", { name: "Filter review" });
const search = () => screen.getByRole("searchbox", { name: "Search sessions" });
const mount = () => render(<FraudDashboardOfflinePreview enabled report={report} />);

describe("Offline controller React integration preview", () => {
  it("defaults to disabled with no sessions, even with an untrusted report", () => {
    const read = vi.fn(() => { throw new Error("REPORT_READ_FORBIDDEN"); });
    render(<FraudDashboardOfflinePreview report={new Proxy({}, { get: read })} />);
    expect(screen.getByText("Mode: disabled")).toBeTruthy();
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("No sessions.")).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it("requires literal true and explicitly supplied valid data", () => {
    const { rerender } = render(<FraudDashboardOfflinePreview enabled="true" report={report} />);
    expect(screen.getByText("Mode: disabled")).toBeTruthy();
    rerender(<FraudDashboardOfflinePreview enabled />);
    expect(screen.getByRole("alert").textContent).toContain("Invalid synthetic report");
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
  });

  it("renders synthetic sessions, games, KPI counts and separate advisory flags", () => {
    mount();
    expect(screen.getByText("Mode: validated-sandbox")).toBeTruthy();
    expect(within(sessions()).getAllByRole("button")).toHaveLength(2);
    expect(within(sessions()).getAllByText("Game: Monkey")).toHaveLength(2);
    expect(screen.getAllByRole("definition").map(node => node.textContent))
      .toEqual(["2", "0", "1", "1"]);
    expect(within(sessions()).getByText("Behavioral Signals V1: Review suggested (advisory only)")).toBeTruthy();
    expect(within(sessions()).getAllByText("Integrity V2: No review required")).toHaveLength(2);
  });

  it("filters games and restores all sessions", async () => {
    mount();
    const user = userEvent.setup();
    await user.selectOptions(game(), "perfect-shot");
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
    await user.selectOptions(game(), "monkey");
    expect(within(sessions()).getAllByRole("button")).toHaveLength(2);
  });

  it("filters behavioral, normal and integrity reviews separately", async () => {
    mount();
    const user = userEvent.setup();
    await user.selectOptions(review(), "behavior");
    expect(within(sessions()).getByRole("button", { name: secondId })).toBeTruthy();
    expect(within(sessions()).queryByRole("button", { name: firstId })).toBeNull();
    await user.selectOptions(review(), "normal");
    expect(within(sessions()).getByRole("button", { name: firstId })).toBeTruthy();
    await user.selectOptions(review(), "integrity");
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
  });

  it("searches session IDs case-insensitively", () => {
    mount();
    fireEvent.change(search(), { target: { value: firstId.toUpperCase() } });
    expect(within(sessions()).getAllByRole("button")).toHaveLength(1);
    expect(within(sessions()).getByRole("button", { name: firstId })).toBeTruthy();
  });

  it("shows selected session details and clears them when filtered out", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: secondId }));
    expect(within(details()).getByText("Session: " + secondId)).toBeTruthy();
    expect(within(details()).getByRole("heading", { name: "Integrity V2" })).toBeTruthy();
    expect(within(details()).getByRole("heading", { name: "Behavioral Signals V1" })).toBeTruthy();
    expect(within(details()).getByText("Signals: HIGHLY_REGULAR_TAP_CADENCE")).toBeTruthy();
    await user.selectOptions(review(), "normal");
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
    await user.selectOptions(review(), "all");
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
  });

  it("resets filters, search, selection and counts", async () => {
    mount();
    const user = userEvent.setup();
    await user.selectOptions(game(), "monkey");
    await user.selectOptions(review(), "normal");
    fireEvent.change(search(), { target: { value: firstId } });
    await user.click(screen.getByRole("button", { name: firstId }));
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(game().value).toBe("all");
    expect(review().value).toBe("all");
    expect(search().value).toBe("");
    expect(within(sessions()).getAllByRole("button")).toHaveLength(2);
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
  });

  it("preserves the valid view, controls and selection after invalid updates", async () => {
    mount();
    await userEvent.setup().click(screen.getByRole("button", { name: firstId }));
    const before = sessions().textContent;
    fireEvent.change(search(), { target: { value: "x".repeat(201) } });
    expect(screen.getByRole("alert").textContent).toContain("Previous view preserved");
    expect(search().value).toBe("");
    expect(sessions().textContent).toBe(before);
    expect(within(details()).getByText("Session: " + firstId)).toBeTruthy();
    fireEvent.change(search(), { target: { value: firstId } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(sessions()).getAllByRole("button")).toHaveLength(1);
  });

  it("retains controller state across normal renders and StrictMode", () => {
    const element = <StrictMode><FraudDashboardOfflinePreview enabled report={report} /></StrictMode>;
    const { rerender } = render(element);
    fireEvent.change(search(), { target: { value: firstId } });
    rerender(<StrictMode><FraudDashboardOfflinePreview enabled report={report} /></StrictMode>);
    // The next partial update must still include the controller's prior search.
    fireEvent.change(review(), { target: { value: "normal" } });
    expect(search().value).toBe(firstId);
    expect(within(sessions()).getAllByRole("button")).toHaveLength(1);
  });

  it("clears prior sessions immediately when explicitly disabled", async () => {
    const { rerender } = mount();
    await userEvent.setup().click(screen.getByRole("button", { name: secondId }));
    expect(within(details()).getByText("Session: " + secondId)).toBeTruthy();
    expect(within(details()).getByText("Signals: HIGHLY_REGULAR_TAP_CADENCE")).toBeTruthy();
    rerender(<FraudDashboardOfflinePreview enabled={false} report={report} />);
    expect(screen.getByText("Mode: disabled")).toBeTruthy();
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
    expect(screen.queryByText("Session: " + secondId)).toBeNull();
    expect(screen.queryByText("Signals: HIGHLY_REGULAR_TAP_CADENCE")).toBeNull();
    expect(screen.queryByText(firstId)).toBeNull();
    expect(screen.queryByText(secondId)).toBeNull();
    expect(screen.getAllByRole("definition").map(node => node.textContent))
      .toEqual(["0", "0", "0", "0"]);
  });

  it("replaces valid report data and resets all prior user state", async () => {
    const { rerender } = mount();
    const user = userEvent.setup();
    await user.selectOptions(game(), "monkey");
    await user.selectOptions(review(), "normal");
    fireEvent.change(search(), { target: { value: firstId } });
    await user.click(screen.getByRole("button", { name: firstId }));
    expect(within(details()).getByText("Session: " + firstId)).toBeTruthy();

    const newIds = ["aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"];
    const campaignId = "hnc-synthetic-replacement";
    const replacement = {
      ...report,
      campaignId,
      reports: report.reports.map((session, index) => ({
        ...session,
        sessionId: newIds[index],
        campaignId,
        gameId: "perfect-shot",
      })),
    };
    expect(replacement).not.toBe(report);
    expect(() => validateFraudReportResponse(replacement)).not.toThrow();
    rerender(<FraudDashboardOfflinePreview enabled report={replacement} />);

    expect(screen.getByText("Mode: validated-sandbox")).toBeTruthy();
    expect(game().value).toBe("all");
    expect(review().value).toBe("all");
    expect(search().value).toBe("");
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
    expect(within(sessions()).getAllByRole("button").map(button => button.textContent))
      .toEqual(newIds);
    expect(within(sessions()).getAllByText("Game: Perfect Shot")).toHaveLength(2);
    expect(screen.getAllByRole("definition").map(node => node.textContent))
      .toEqual(["2", "0", "1", "1"]);
    expect(screen.queryByText(firstId)).toBeNull();
    expect(screen.queryByText(secondId)).toBeNull();
    expect(screen.queryByText("Session: " + firstId)).toBeNull();
    expect(screen.queryByText("Campaign: " + report.campaignId)).toBeNull();
    await user.click(screen.getByRole("button", { name: newIds[0] }));
    expect(within(details()).getByText("Campaign: " + campaignId)).toBeTruthy();
  });

  it("fails closed on an invalid replacement without exposing old or unsafe data", async () => {
    const { rerender, container } = mount();
    await userEvent.setup().click(screen.getByRole("button", { name: secondId }));
    expect(within(sessions()).getAllByRole("button")).toHaveLength(2);
    expect(within(details()).getByText("Session: " + secondId)).toBeTruthy();

    const unsafeText = "UNSAFE_REPLACEMENT_MUST_NOT_RENDER";
    const invalid = {
      ...report,
      campaignId: unsafeText,
      prizeAllocated: true,
      reports: report.reports.map(session => ({ ...session, campaignId: unsafeText, status: unsafeText })),
    };
    expect(invalid).not.toBe(report);
    expect(() => validateFraudReportResponse(invalid)).toThrow();
    rerender(<FraudDashboardOfflinePreview enabled report={invalid} />);

    expect(screen.getByText("Mode: disabled")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Invalid synthetic report");
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
    expect(within(details()).getByText("No session selected.")).toBeTruthy();
    expect(screen.getAllByRole("definition").map(node => node.textContent))
      .toEqual(["0", "0", "0", "0"]);
    for (const text of [firstId, secondId, report.campaignId, unsafeText, "HIGHLY_REGULAR_TAP_CADENCE"]) {
      expect(container.textContent).not.toContain(text);
    }
  });

  it("preserves filters, search and selection on an ordinary same-report rerender", async () => {
    const { rerender } = mount();
    const user = userEvent.setup();
    await user.selectOptions(game(), "monkey");
    await user.selectOptions(review(), "behavior");
    fireEvent.change(search(), { target: { value: secondId.toUpperCase() } });
    await user.click(screen.getByRole("button", { name: secondId }));
    const previousDetails = details().textContent;
    rerender(<FraudDashboardOfflinePreview enabled report={report} />);

    expect(game().value).toBe("monkey");
    expect(review().value).toBe("behavior");
    expect(search().value).toBe(secondId.toUpperCase());
    expect(within(sessions()).getAllByRole("button")).toHaveLength(1);
    expect(within(sessions()).getByRole("button", { name: secondId })).toBeTruthy();
    expect(details().textContent).toBe(previousDetails);
    expect(within(details()).getByText("Session: " + secondId)).toBeTruthy();
    // A subsequent partial update must retain the controller's other fields too.
    await user.selectOptions(review(), "all");
    expect(game().value).toBe("monkey");
    expect(search().value).toBe(secondId.toUpperCase());
    expect(within(sessions()).getAllByRole("button")).toHaveLength(1);
    expect(within(details()).getByText("Session: " + secondId)).toBeTruthy();
  });

  it("fails closed for unsafe report data", () => {
    const unsafe = structuredClone(report);
    unsafe.prizeAllocated = true;
    render(<FraudDashboardOfflinePreview enabled report={unsafe} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Mode: disabled")).toBeTruthy();
    expect(within(sessions()).queryAllByRole("button")).toHaveLength(0);
  });

  it("renders permitted report text as text rather than HTML", async () => {
    const synthetic = structuredClone(report);
    synthetic.reports[0].status = "<img src=x onerror=alert(1)>";
    render(<FraudDashboardOfflinePreview enabled report={synthetic} />);
    await userEvent.setup().click(screen.getByRole("button", { name: firstId }));
    expect(within(details()).getByText("Status: <img src=x onerror=alert(1)>")).toBeTruthy();
    expect(details().querySelector("img")).toBeNull();
  });

  it("has no network, storage or prize action side effects", async () => {
    const forbidden = vi.fn(() => { throw new Error("SIDE_EFFECT_FORBIDDEN"); });
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "allocatePrize", "redeemPrize"]) {
      vi.stubGlobal(name, forbidden);
    }
    for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(forbidden);
    }
    const before = JSON.stringify(report);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: secondId }));
    await user.selectOptions(review(), "behavior");
    fireEvent.change(search(), { target: { value: secondId } });
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.queryByRole("button", { name: /allocate|redeem|approve|reject/i })).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).toBe(before);
  });
});
