"use strict";

import { createFraudDashboardViewModel } from "./fraudDashboardViewModel";
import { filterFraudDashboardSessions } from "./fraudDashboardFilters";

const DEFAULT_STATE = Object.freeze({
  gameFilter: "all",
  reviewFilter: "all",
  search: "",
  selectedId: null,
});

// Offline state only. No transport, storage, or prize operations.
export function createFraudDashboardStateController({
  enabled = false,
  report = null,
} = {}) {
  let state = DEFAULT_STATE;
  let view = createFraudDashboardViewModel({ enabled, report, ...state });

  function commit(proposed) {
    // The disabled view model intentionally skips input validation, so validate
    // state independently without inspecting report data or enabling the view.
    if (
      typeof proposed.gameFilter !== "string" ||
      typeof proposed.reviewFilter !== "string" ||
      typeof proposed.search !== "string"
    ) {
      throw new Error("INVALID_DASHBOARD_FILTER");
    }
    filterFraudDashboardSessions([], proposed);
    if (
      proposed.selectedId !== null &&
      (typeof proposed.selectedId !== "string" ||
        !/^[a-f0-9]{24}$/i.test(proposed.selectedId))
    ) {
      throw new Error("INVALID_DASHBOARD_SELECTION");
    }

    const nextView = createFraudDashboardViewModel({
      enabled,
      report,
      ...proposed,
    });

    // Hidden selections are cleared, rather than resurfacing on a later filter.
    const nextState = Object.freeze({
      ...proposed,
      selectedId: nextView.selectedReport ? proposed.selectedId : null,
    });
    state = nextState;
    view = nextView;
    return view;
  }

  function update(patch) {
    if (
      patch === null ||
      typeof patch !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(patch))
    ) {
      throw new Error("INVALID_DASHBOARD_UPDATE");
    }

    const proposed = { ...state };
    for (const key of Reflect.ownKeys(patch)) {
      if (!Object.hasOwn(DEFAULT_STATE, key)) {
        throw new Error("UNKNOWN_DASHBOARD_STATE_FIELD");
      }
      const descriptor = Object.getOwnPropertyDescriptor(patch, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        throw new Error("INVALID_DASHBOARD_UPDATE");
      }
      proposed[key] = descriptor.value;
    }
    return commit(proposed);
  }

  return Object.freeze({
    snapshot: () => view,
    update,
    reset: () => commit(DEFAULT_STATE),
  });
}
