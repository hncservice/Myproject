import React, { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import report from "../data/fixtures/fraudReportBackend.contract.json";
import { createFraudDashboardStateController } from "../data/fraudDashboardStateController";
import { useOfflineFraudDashboard } from "./useOfflineFraudDashboard";

vi.mock("../data/fraudDashboardStateController", { spy: true });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const firstId = report.reports[0].sessionId;
const secondId = report.reports[1].sessionId;
const defaults = { gameFilter: "all", reviewFilter: "all", search: "" };
const mount = () => renderHook(() => useOfflineFraudDashboard({ enabled: true, report }));

describe("Shared offline fraud dashboard lifecycle hook", () => {
  it("initializes disabled with empty immutable view and default controls", () => {
    const { result } = renderHook(() => useOfflineFraudDashboard());
    expect(result.current.view.mode).toBe("disabled");
    expect(result.current.view.sessions).toEqual([]);
    expect(result.current.view.selectedReport).toBeNull();
    expect(result.current.filters).toEqual(defaults);
    expect(result.current.error).toBe("");
    expect(Object.isFrozen(result.current.view)).toBe(true);
    expect(Object.isFrozen(result.current.filters)).toBe(true);
  });

  it("does not inspect untrusted reports unless literally enabled", () => {
    const read = vi.fn(() => { throw new Error("UNTRUSTED_REPORT_READ"); });
    const untrusted = new Proxy({}, { get: read });
    const { result } = renderHook(() => useOfflineFraudDashboard({ enabled: "true", report: untrusted }));
    act(() => result.current.update({ search: "query" }));
    act(() => result.current.reset());
    expect(result.current.view.sessions).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it("initializes from explicitly enabled validated synthetic data", () => {
    const { result } = mount();
    expect(result.current.view.sessions.map(session => session.sessionId)).toEqual([firstId, secondId]);
    expect(result.current.view.metrics).toEqual({ total: 2, integrity: 0, behavioral: 1, normal: 1 });
    expect(result.current.view.sessions[1].integrity.assessmentVersion).toBe(2);
    expect(result.current.view.sessions[1].behavior.behaviorVersion).toBe(1);
  });

  it("reuses its controller and handlers during ordinary unchanged-input rerenders", () => {
    const { result, rerender } = mount();
    const update = result.current.update;
    const reset = result.current.reset;
    const controller = vi.mocked(createFraudDashboardStateController).mock.results.at(-1).value;
    const calls = vi.mocked(createFraudDashboardStateController).mock.calls.length;
    act(() => result.current.update({ search: firstId, selectedId: firstId }));
    const view = result.current.view;
    rerender();
    expect(createFraudDashboardStateController).toHaveBeenCalledTimes(calls);
    expect(result.current.update).toBe(update);
    expect(result.current.reset).toBe(reset);
    expect(result.current.view).toBe(view);
    expect(controller.snapshot()).toBe(view);
    expect(result.current.view.selectedReport.sessionId).toBe(firstId);
  });

  it("replaces valid input immediately with fresh controller data and default state", () => {
    const observed = [];
    const { result, rerender } = renderHook(props => {
      const value = useOfflineFraudDashboard(props);
      observed.push(value);
      return value;
    }, { initialProps: { enabled: true, report } });
    act(() => result.current.update({ gameFilter: "monkey", reviewFilter: "normal", search: firstId, selectedId: firstId }));
    const oldController = vi.mocked(createFraudDashboardStateController).mock.results.at(-1).value;
    const replacement = {
      ...report,
      reports: report.reports.map((session, index) => ({
        ...session,
        sessionId: index === 0 ? "aaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbb",
      })),
    };
    observed.length = 0;
    rerender({ enabled: true, report: replacement });
    const newController = vi.mocked(createFraudDashboardStateController).mock.results.at(-1).value;
    expect(newController).not.toBe(oldController);
    expect(observed.length).toBeGreaterThan(0);
    for (const value of observed) {
      expect(value.view.sessions.map(session => session.sessionId))
        .toEqual(["aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"]);
      expect(value.filters).toEqual(defaults);
      expect(value.view.selectedReport).toBeNull();
    }
  });

  it("fails closed on every render of an invalid replacement without old details", () => {
    const observed = [];
    const { result, rerender } = renderHook(props => {
      const value = useOfflineFraudDashboard(props);
      observed.push(value);
      return value;
    }, { initialProps: { enabled: true, report } });
    act(() => result.current.update({ selectedId: firstId, search: firstId }));
    const invalid = { ...report, prizeAllocated: true };
    observed.length = 0;
    rerender({ enabled: true, report: invalid });
    expect(observed.length).toBeGreaterThan(0);
    for (const value of observed) {
      expect(value.view.mode).toBe("disabled");
      expect(value.view.sessions).toEqual([]);
      expect(value.view.selectedReport).toBeNull();
      expect(value.filters).toEqual(defaults);
      expect(value.error).toContain("Invalid synthetic report");
    }
    act(() => result.current.reset());
    expect(result.current.error).toContain("Invalid synthetic report");
  });

  it("disables and reenables with no stale sessions selection or filters", () => {
    const observed = [];
    const { result, rerender } = renderHook(props => {
      const value = useOfflineFraudDashboard(props);
      observed.push(value);
      return value;
    }, { initialProps: { enabled: true, report } });
    act(() => result.current.update({ selectedId: firstId, search: firstId }));
    observed.length = 0;
    rerender({ enabled: false, report });
    for (const value of observed) {
      expect(value.view.sessions).toEqual([]);
      expect(value.view.selectedReport).toBeNull();
      expect(value.filters).toEqual(defaults);
    }
    rerender({ enabled: true, report });
    expect(result.current.view.sessions).toHaveLength(2);
    expect(result.current.view.selectedReport).toBeNull();
    expect(result.current.filters).toEqual(defaults);
  });

  it("preserves valid view and input identities on rejected updates", () => {
    const { result } = mount();
    act(() => result.current.update({ reviewFilter: "normal", search: firstId, selectedId: firstId }));
    const before = result.current;
    for (const patch of [
      { search: "x".repeat(201) }, { gameFilter: "invalid" },
      { selectedId: "invalid" }, { enablePrizeAllocation: true }, null,
    ]) {
      act(() => result.current.update(patch));
      expect(result.current.view).toBe(before.view);
      expect(result.current.filters).toBe(before.filters);
      expect(result.current.error).toContain("Previous view preserved");
    }
    act(() => result.current.update({ gameFilter: "monkey" }));
    expect(result.current.error).toBe("");
    expect(result.current.view.selectedReport.sessionId).toBe(firstId);
    expect(result.current.filters.search).toBe(firstId);
  });

  it("resets controls selection and errors without replacing the controller", () => {
    const { result } = mount();
    const calls = vi.mocked(createFraudDashboardStateController).mock.calls.length;
    act(() => result.current.update({ search: firstId, selectedId: firstId }));
    act(() => result.current.update({ search: "x".repeat(201) }));
    act(() => result.current.reset());
    expect(result.current.filters).toEqual(defaults);
    expect(result.current.view.sessions).toHaveLength(2);
    expect(result.current.view.selectedReport).toBeNull();
    expect(result.current.error).toBe("");
    expect(createFraudDashboardStateController).toHaveBeenCalledTimes(calls);
  });

  it("composes multiple updates in one batch without stale control closures", () => {
    const { result } = mount();
    const update = result.current.update;
    act(() => {
      update({ search: secondId });
      update({ reviewFilter: "behavior" });
      update({ gameFilter: "monkey", selectedId: secondId });
    });
    expect(result.current.filters).toEqual({ gameFilter: "monkey", reviewFilter: "behavior", search: secondId });
    expect(result.current.view.sessions).toHaveLength(1);
    expect(result.current.view.selectedReport.sessionId).toBe(secondId);
  });

  it("keeps detached old handlers from changing a replacement store", () => {
    const { result, rerender } = renderHook(props => useOfflineFraudDashboard(props), {
      initialProps: { enabled: true, report },
    });
    const oldUpdate = result.current.update;
    rerender({ enabled: false, report });
    const before = result.current;
    act(() => oldUpdate({ selectedId: firstId, search: firstId }));
    expect(result.current.view).toBe(before.view);
    expect(result.current.filters).toBe(before.filters);
    expect(result.current.view.sessions).toEqual([]);
  });

  it("handles StrictMode subscriptions and transitions without render-time updates", () => {
    const errors = vi.spyOn(console, "error");
    const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;
    const { result, rerender, unmount } = renderHook(props => useOfflineFraudDashboard(props), {
      wrapper, initialProps: { enabled: true, report },
    });
    act(() => result.current.update({ selectedId: secondId }));
    expect(result.current.view.selectedReport.sessionId).toBe(secondId);
    rerender({ enabled: false, report });
    expect(result.current.view.sessions).toEqual([]);
    rerender({ enabled: true, report });
    expect(result.current.view.selectedReport).toBeNull();
    unmount();
    expect(errors).not.toHaveBeenCalled();
  });

  it("has no network storage or prize side effects through the full lifecycle", () => {
    const forbidden = vi.fn(() => { throw new Error("SIDE_EFFECT_FORBIDDEN"); });
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "allocatePrize", "redeemPrize"]) {
      vi.stubGlobal(name, forbidden);
    }
    for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(forbidden);
    }
    const original = JSON.stringify(report);
    const { result, rerender, unmount } = renderHook(props => useOfflineFraudDashboard(props), {
      initialProps: { enabled: true, report },
    });
    act(() => result.current.update({ selectedId: firstId, search: firstId }));
    act(() => result.current.reset());
    rerender({ enabled: true, report: { ...report } });
    rerender({ enabled: true, report: { ...report, prizeAllocated: true } });
    rerender({ enabled: false, report });
    unmount();
    expect(forbidden).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).toBe(original);
  });
});
