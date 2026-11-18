import { afterEach, describe, expect, it, vi } from "vitest";

import report from "./fixtures/fraudReportBackend.contract.json";
import { createFraudDashboardStateController } from "./fraudDashboardStateController";

const firstId = report.reports[0].sessionId;
const makeController = () =>
  createFraudDashboardStateController({ enabled: true, report });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Offline Fraud Dashboard State Controller", () => {
  it("is disabled by default", () => {
    const view = createFraudDashboardStateController().snapshot();
    expect(view.mode).toBe("disabled");
    expect(view.sessions).toEqual([]);
    expect(view.metrics.total).toBe(0);
    expect(view.selectedReport).toBeNull();
  });

  it("never inspects untrusted report data while disabled", () => {
    const read = vi.fn(() => { throw new Error("REPORT_READ_FORBIDDEN"); });
    const untrusted = new Proxy({}, { get: read, ownKeys: read });
    const controller = createFraudDashboardStateController({ report: untrusted });
    controller.update({ search: "test", selectedId: firstId });
    controller.reset();
    expect(controller.snapshot().sessions).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(createFraudDashboardStateController({ enabled: "true", report: untrusted })
      .snapshot().mode).toBe("disabled");
  });

  it("loads the existing synthetic contract only when explicitly enabled", () => {
    const before = JSON.stringify(report);
    const view = makeController().snapshot();
    expect(view.mode).toBe("validated-sandbox");
    expect(view.sessions.map(session => session.sessionId))
      .toEqual(report.reports.map(session => session.sessionId));
    expect(view.metrics.total).toBe(2);
    expect(JSON.stringify(report)).toBe(before);
  });

  it("updates game filters", () => {
    const controller = makeController();
    expect(controller.update({ gameFilter: "perfect-shot" }).sessions).toEqual([]);
    expect(controller.update({ gameFilter: "monkey" }).sessions).toHaveLength(2);
    expect(controller.update({ gameFilter: "all" }).metrics.total).toBe(2);
  });

  it("updates each review filter", () => {
    const controller = makeController();
    expect(controller.update({ reviewFilter: "behavior" }).metrics.behavioral).toBe(1);
    expect(controller.snapshot().sessions).toHaveLength(1);
    expect(controller.update({ reviewFilter: "normal" }).metrics.normal).toBe(1);
    expect(controller.update({ reviewFilter: "integrity" }).sessions).toEqual([]);
    expect(controller.update({ reviewFilter: "all" }).sessions).toHaveLength(2);
  });

  it("searches session IDs and campaigns case-insensitively", () => {
    const controller = makeController();
    expect(controller.update({ search: ` ${firstId.toUpperCase()} ` }).sessions)
      .toHaveLength(1);
    expect(controller.snapshot().sessions[0].sessionId).toBe(firstId);
    expect(controller.update({ search: report.campaignId.toUpperCase() }).sessions)
      .toHaveLength(2);
  });

  it("selects a visible session and allows explicitly clearing it", () => {
    const controller = makeController();
    expect(controller.update({ selectedId: firstId }).selectedReport.sessionId).toBe(firstId);
    expect(controller.update({ selectedId: null }).selectedReport).toBeNull();
  });

  it("clears hidden selections permanently until explicitly reselected", () => {
    const controller = makeController();
    controller.update({ selectedId: firstId });
    expect(controller.update({ gameFilter: "perfect-shot" }).selectedReport).toBeNull();
    expect(controller.update({ gameFilter: "all" }).selectedReport).toBeNull();
    expect(controller.update({ selectedId: report.notFound[0] }).selectedReport).toBeNull();
  });

  it("rejects invalid filters and searches, including in disabled mode", () => {
    for (const controller of [makeController(), createFraudDashboardStateController()]) {
      for (const patch of [
        { gameFilter: "unknown" }, { reviewFilter: "unknown" },
        { gameFilter: undefined }, { reviewFilter: null },
        { search: 123 }, { search: "x".repeat(201) },
      ]) {
        expect(() => controller.update(patch)).toThrow("INVALID_DASHBOARD_FILTER");
      }
      expect(() => controller.update({ search: "x".repeat(200) })).not.toThrow();
    }
  });

  it("rejects unknown, symbol and prototype-related fields", () => {
    const controller = makeController();
    for (const key of ["enablePrizeAllocation", "enabled", "report", "__proto__",
      "constructor", "prototype", Symbol("search")]) {
      const patch = Object.create(null);
      patch[key] = true;
      expect(() => controller.update(patch)).toThrow("UNKNOWN_DASHBOARD_STATE_FIELD");
    }
    expect(() => controller.update({ __proto__: { search: "unsafe" } })).toThrow();
    expect(Object.prototype.search).toBeUndefined();
  });

  it("rejects malformed update objects without invoking getters", () => {
    const controller = makeController();
    const getter = vi.fn(() => "monkey");
    const accessor = Object.defineProperty({}, "gameFilter", { enumerable: true, get: getter });
    const hidden = Object.defineProperty({}, "search", { value: "hidden" });
    for (const patch of [null, undefined, [], "search", 42, true, () => {}, new Date(), accessor, hidden]) {
      expect(() => controller.update(patch)).toThrow("INVALID_DASHBOARD_UPDATE");
    }
    expect(getter).not.toHaveBeenCalled();
    expect(() => controller.update({})).not.toThrow();
  });

  it("rejects invalid session IDs using the view-model format in either mode", () => {
    for (const controller of [makeController(), createFraudDashboardStateController()]) {
      for (const selectedId of ["SANDBOX-M001", "g".repeat(24), "a".repeat(23),
        "x".repeat(300), {}, 12, undefined, ""]) {
        expect(() => controller.update({ selectedId })).toThrow("INVALID_DASHBOARD_SELECTION");
      }
    }
  });

  it("validates the entire proposed state before committing any field", () => {
    const controller = makeController();
    controller.update({ gameFilter: "monkey", reviewFilter: "normal", selectedId: firstId });
    const before = controller.snapshot();
    for (const patch of [
      { search: "no-match", selectedId: "invalid" },
      { gameFilter: "perfect-shot", reviewFilter: "invalid" },
      { search: "changed", enablePrizeAllocation: true },
    ]) {
      expect(() => controller.update(patch)).toThrow();
      expect(controller.snapshot()).toBe(before);
    }
    expect(controller.update({}).selectedReport.sessionId).toBe(firstId);
  });

  it("preserves the previous snapshot if report validation fails during an update", () => {
    const mutableReport = structuredClone(report);
    const controller = createFraudDashboardStateController({ enabled: true, report: mutableReport });
    const before = controller.snapshot();
    mutableReport.prizeAllocated = true;
    expect(() => controller.update({ search: "changed" })).toThrow();
    expect(controller.snapshot()).toBe(before);
    mutableReport.prizeAllocated = false;
    expect(controller.update({}).sessions).toHaveLength(2);
  });

  it("resets all filters, search and selection to defaults", () => {
    const controller = makeController();
    controller.update({ gameFilter: "monkey", reviewFilter: "normal", search: firstId, selectedId: firstId });
    expect(controller.reset()).toEqual(makeController().snapshot());
    expect(controller.snapshot().selectedReport).toBeNull();
    expect(controller.snapshot().sessions).toHaveLength(2);
  });

  it("returns deeply immutable snapshots and an immutable controller", () => {
    const controller = makeController();
    const before = controller.update({ selectedId: firstId });
    function checkFrozen(value) {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(checkFrozen);
      }
    }
    expect(Object.isFrozen(controller)).toBe(true);
    checkFrozen(before);
    expect(() => { before.sessions[0].behavior.signals.push("unsafe"); }).toThrow();
    controller.update({ search: "no-match" });
    expect(before.sessions).toHaveLength(2);
    expect(before.selectedReport.sessionId).toBe(firstId);
    checkFrozen(createFraudDashboardStateController().snapshot());
  });

  it("performs no network or browser storage operations", () => {
    const forbidden = vi.fn(() => { throw new Error("SIDE_EFFECT_FORBIDDEN"); });
    vi.stubGlobal("fetch", forbidden);
    vi.stubGlobal("XMLHttpRequest", forbidden);
    vi.stubGlobal("WebSocket", forbidden);
    const storageSpies = ["getItem", "setItem", "removeItem", "clear"]
      .map(method => vi.spyOn(Storage.prototype, method).mockImplementation(forbidden));
    const controller = makeController();
    controller.snapshot();
    controller.update({ selectedId: firstId, search: firstId });
    controller.reset();
    expect(forbidden).not.toHaveBeenCalled();
    storageSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
});
