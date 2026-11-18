
import { describe, it, expect, afterEach } from "vitest";

import {
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import FraudMonitoringDashboard from "./FraudMonitoringDashboard";

// =====================================================
// TEST CLEANUP
// =====================================================

afterEach(() => {
  cleanup();
});

// =====================================================
// HNC FRAUD MONITORING DASHBOARD TESTS
// =====================================================

describe("HNC Fraud Monitoring Dashboard", () => {

  // ===================================================
  // TEST 1 — INITIAL DASHBOARD
  // ===================================================

  it("renders four mock sessions", () => {
    render(<FraudMonitoringDashboard />);

    expect(
      screen.getByText("SANDBOX-M001")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-M002")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-M003")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-P001")
    ).toBeTruthy();
  });

  // ===================================================
  // TEST 2 — GAME FILTER
  // ===================================================

  it("filters Monkey sessions", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter game",
      }),
      "monkey"
    );

    expect(
      screen.getByText("SANDBOX-M001")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-M002")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-M003")
    ).toBeTruthy();

    expect(
      screen.queryByText("SANDBOX-P001")
    ).toBeNull();

    // Header + 3 Monkey sessions
    expect(
      screen.getAllByRole("row")
    ).toHaveLength(4);
  });

  // ===================================================
  // TEST 3 — BEHAVIORAL WARNING FILTER
  // ===================================================

  it("filters behavioral warnings", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter review status",
      }),
      "behavior"
    );

    expect(
      screen.getByText("SANDBOX-M002")
    ).toBeTruthy();

    expect(
      screen.queryByText("SANDBOX-M001")
    ).toBeNull();

    expect(
      screen.queryByText("SANDBOX-M003")
    ).toBeNull();

    expect(
      screen.queryByText("SANDBOX-P001")
    ).toBeNull();

    // Header + 1 behavioral warning
    expect(
      screen.getAllByRole("row")
    ).toHaveLength(2);
  });

  // ===================================================
  // TEST 4 — SESSION SEARCH
  // ===================================================

  it("searches a specific session", async () => {
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

    expect(
      screen.queryByText("SANDBOX-M001")
    ).toBeNull();

    expect(
      screen.queryByText("SANDBOX-M002")
    ).toBeNull();

    expect(
      screen.queryByText("SANDBOX-M003")
    ).toBeNull();

    // Header + 1 matching session
    expect(
      screen.getAllByRole("row")
    ).toHaveLength(2);
  });

  // ===================================================
  // TEST 5 — NORMAL SESSION FILTER
  // ===================================================

  it("filters normal sessions", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter review status",
      }),
      "normal"
    );

    expect(
      screen.getByText("SANDBOX-M001")
    ).toBeTruthy();

    expect(
      screen.getByText("SANDBOX-P001")
    ).toBeTruthy();

    expect(
      screen.queryByText("SANDBOX-M002")
    ).toBeNull();

    expect(
      screen.queryByText("SANDBOX-M003")
    ).toBeNull();

    // Header + 2 normal sessions
    expect(
      screen.getAllByRole("row")
    ).toHaveLength(3);
  });
  
  // TEST 7 — COMBINED FILTERS
  it("combines game and review filters", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter game" }),
      "monkey"
    );

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter review status",
      }),
      "behavior"
    );

    expect(screen.getByText("SANDBOX-M002")).toBeTruthy();
    expect(screen.queryByText("SANDBOX-M001")).toBeNull();
    expect(screen.queryByText("SANDBOX-P001")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  // TEST 8 — EMPTY RESULTS
  it("displays an empty state when nothing matches", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.type(
      screen.getByRole("textbox", {
        name: "Search session or campaign",
      }),
      "NOT-EXISTING-SESSION"
    );

    expect(
      screen.getByText("No matching sessions")
    ).toBeTruthy();

    expect(screen.queryByText("SANDBOX-M001")).toBeNull();
  });

  // TEST 9 — KPI COUNTS UPDATE
  it("updates KPI counts after filtering", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter game" }),
      "perfect-shot"
    );

    const cards = [
      ["Sessions Analyzed", "1"],
      ["Integrity Reviews", "0"],
      ["Behavioral Warnings", "0"],
      ["Normal Sessions", "1"],
    ];

    for (const [label, count] of cards) {
      const labelElement = screen
        .getAllByText(label)
        .find((element) => element.tagName === "P");

      expect(labelElement).toBeDefined();

      const card = labelElement.parentElement;

      expect(
        within(card).getByRole("heading", {
          level: 2,
          name: count,
        })
      ).toBeTruthy();
    }
  });

  // TEST 10 — RESET FILTERS
  it("restores all sessions after clearing filters", async () => {
    const user = userEvent.setup();

    render(<FraudMonitoringDashboard />);

    const gameFilter = screen.getByRole("combobox", {
      name: "Filter game",
    });

    const reviewFilter = screen.getByRole("combobox", {
      name: "Filter review status",
    });

    const search = screen.getByRole("textbox", {
      name: "Search session or campaign",
    });

    await user.selectOptions(gameFilter, "monkey");
    await user.selectOptions(reviewFilter, "behavior");
    await user.type(search, "SANDBOX-M002");

    expect(screen.getAllByRole("row")).toHaveLength(2);

    await user.selectOptions(gameFilter, "all");
    await user.selectOptions(reviewFilter, "all");
    await user.clear(search);

    // Header + four mock sessions
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });


  // ===================================================
  // TEST 6 — KPI SUMMARY COUNTS
  // ===================================================

  it("shows correct integrity and behavioral counts", () => {
    render(<FraudMonitoringDashboard />);

    const cards = [
      ["Sessions Analyzed", "4"],
      ["Integrity Reviews", "1"],
      ["Behavioral Warnings", "1"],
      ["Normal Sessions", "2"],
    ];

    for (const [label, count] of cards) {

      // KPI labels are rendered inside <p> elements.
      // Filter dropdowns may contain identical text.
      const labelElement = screen
        .getAllByText(label)
        .find((element) => element.tagName === "P");

      expect(labelElement).toBeDefined();

      const card = labelElement.parentElement;

      // The numeric KPI appears inside the card's h2.
      const valueElement = within(card).getByRole(
        "heading",
        {
          level: 2,
          name: count,
        }
      );

      expect(valueElement).toBeTruthy();
    }
  });

});
