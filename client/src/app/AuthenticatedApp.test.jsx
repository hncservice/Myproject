import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthenticatedApp from "./AuthenticatedApp";

const account = vi.hoisted(() => ({
  role: "user", token: "synthetic-token", profile: { name: "Synthetic user" },
  login: vi.fn(), logout: vi.fn(),
}));
vi.mock("../features/authentication/context/AuthContext", async () => {
  const React = await import("react");
  const Context = React.createContext(null);
  return {
    AuthProvider: ({ children }) => (
      <Context.Provider value={account}><div data-testid="auth-boundary">{children}</div></Context.Provider>
    ),
    useAuth: () => React.useContext(Context),
  };
});
vi.mock("./layout/Layout", async () => {
  const { useAuth } = await import("../features/authentication/context/AuthContext");
  const { useInRouterContext } = await import("react-router-dom");
  return { default: ({ children }) => {
    const context = useAuth();
    expect(context).toBe(account);
    expect(useInRouterContext()).toBe(true);
    return <section data-testid="layout-boundary" data-role={context.role}>{children}</section>;
  } };
});
vi.mock("./routes/AppRoutes", async () => {
  const { useAuth } = await import("../features/authentication/context/AuthContext");
  const { useLocation } = await import("react-router-dom");
  return { default: () => {
    const context = useAuth();
    expect(context).toBe(account);
    const location = useLocation();
    return <p data-testid="authenticated-route">{context.role}:{context.token}:{location.pathname}</p>;
  } };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Future authenticated application boundary", () => {
  it.each(["user", "vendor", "admin"])("composes one provider and layout around routes for %s context", role => {
    account.role = role;
    const forbidden = vi.fn(() => { throw new Error("REAL_AUTH_SIDE_EFFECT_FORBIDDEN"); });
    for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(forbidden);
    }
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) vi.stubGlobal(name, forbidden);
    render(<MemoryRouter initialEntries={["/synthetic-auth-check"]}><AuthenticatedApp /></MemoryRouter>);
    expect(screen.getAllByTestId("auth-boundary")).toHaveLength(1);
    expect(screen.getAllByTestId("layout-boundary")).toHaveLength(1);
    expect(screen.getAllByTestId("authenticated-route")).toHaveLength(1);
    const boundary = screen.getByTestId("auth-boundary");
    const layout = screen.getByTestId("layout-boundary");
    expect(boundary.firstElementChild).toBe(layout);
    expect(layout.firstElementChild).toBe(screen.getByTestId("authenticated-route"));
    expect(screen.getByTestId("authenticated-route").textContent)
      .toBe(`${role}:synthetic-token:/synthetic-auth-check`);
    expect(account.login).not.toHaveBeenCalled();
    expect(account.logout).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });
});
