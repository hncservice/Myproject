import { useMemo, useSyncExternalStore } from "react";
import { createFraudDashboardStateController } from "../data/fraudDashboardStateController";

const defaultFilters = () => Object.freeze({ gameFilter: "all", reviewFilter: "all", search: "" });
const UPDATE_ERROR = "Invalid dashboard update. Previous view preserved.";

// A subscription bridge to the existing controller, not another validator.
// Construction and snapshot reads are pure; only event handlers publish changes.
function createStore(enabled, report) {
  let controller;
  let initialError = "";
  try {
    controller = createFraudDashboardStateController({ enabled, report });
  } catch {
    controller = createFraudDashboardStateController();
    initialError = "Invalid synthetic report. Preview remains disabled.";
  }

  let current = Object.freeze({
    view: controller.snapshot(),
    filters: defaultFilters(),
    error: initialError,
  });
  const listeners = new Set();
  function publish(next) {
    current = Object.freeze(next);
    listeners.forEach(listener => listener());
  }

  return Object.freeze({
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => current,
    update(patch) {
      try {
        // Copy control values without invoking accessors. The controller alone
        // validates the patch; none of these tentative values publish on failure.
        const filters = { ...current.filters };
        for (const key of Object.keys(filters)) {
          const field = patch == null ? undefined : Object.getOwnPropertyDescriptor(patch, key);
          if (field && Object.hasOwn(field, "value")) filters[key] = field.value;
        }
        const view = controller.update(patch);
        publish({ view, filters: Object.freeze(filters), error: "" });
      } catch {
        publish({ ...current, error: UPDATE_ERROR });
      }
    },
    reset() {
      try {
        const view = controller.reset();
        publish({ view, filters: defaultFilters(), error: initialError });
      } catch {
        publish({ ...current, error: UPDATE_ERROR });
      }
    },
  });
}

export function useOfflineFraudDashboard({ enabled = false, report = null } = {}) {
  // New input identities start a fresh store immediately. No old snapshot is
  // returned while waiting for an effect, and ordinary rerenders reuse the store.
  const store = useMemo(() => createStore(enabled, report), [enabled, report]);
  const current = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { ...current, update: store.update, reset: store.reset };
}
