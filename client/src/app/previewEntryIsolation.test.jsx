import ReactDOM from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const guards = vi.hoisted(() => ({ imported: vi.fn() }));
vi.mock("../features/authentication/context/AuthContext", () => {
  guards.imported("AuthContext");
  throw new Error("PREVIEW_MUST_NOT_IMPORT_AUTH");
});
vi.mock("./AuthenticatedApp", () => {
  guards.imported("AuthenticatedApp");
  throw new Error("PREVIEW_MUST_NOT_IMPORT_AUTHENTICATED_APP");
});
vi.mock("./routes/AppRoutes", () => {
  guards.imported("AppRoutes");
  throw new Error("PREVIEW_MUST_NOT_ACTIVATE_ROUTES");
});
vi.mock("../shared/api/axiosInstance", () => {
  guards.imported("axiosInstance");
  throw new Error("PREVIEW_MUST_NOT_IMPORT_API");
});
vi.mock("axios", () => {
  guards.imported("axios");
  throw new Error("PREVIEW_MUST_NOT_IMPORT_AXIOS");
});

let mountedRoot;
let host;
afterEach(async () => {
  if (mountedRoot) await act(async () => mountedRoot.unmount());
  mountedRoot = undefined;
  host?.remove();
  host = undefined;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Offline preview entry-point isolation", () => {
  it("mounts the real entry and its four mocks without auth, storage, network or routes", async () => {
    // Install guards before importing main.jsx. Do not inspect stored values.
    const forbidden = vi.fn(() => { throw new Error("PREVIEW_SIDE_EFFECT_FORBIDDEN"); });
    for (const method of ["getItem", "setItem", "removeItem", "clear", "key"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(forbidden);
    }
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "allocatePrize"]) {
      vi.stubGlobal(name, forbidden);
    }
    host = document.createElement("div");
    host.id = "root";
    document.body.append(host);
    const rootSpy = vi.spyOn(ReactDOM, "createRoot");
    await act(async () => { await import("../main.jsx"); });
    expect(rootSpy).toHaveBeenCalledExactlyOnceWith(host);
    mountedRoot = rootSpy.mock.results[0].value;
    const ids = ["SANDBOX-M001", "SANDBOX-M002", "SANDBOX-M003", "SANDBOX-P001"];
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    ids.forEach(id => expect(within(table).getByText(id)).toBeTruthy());
    expect(screen.getByText("SANDBOX · MOCK DATA")).toBeTruthy();
    const row = within(table).getByText("SANDBOX-M002").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "View Details" }));
    expect(within(screen.getByRole("region", { name: "Session details" }))
      .getByText("SANDBOX-M002")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter game" }), { target: { value: "monkey" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter review status" }), { target: { value: "behavior" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search session or campaign" }), { target: { value: "sandbox-m002" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(screen.queryByRole("region", { name: "Session details" })).toBeNull();
    expect(screen.queryByRole("button", { name: /login|logout|register/i })).toBeNull();
    expect(guards.imported).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
    await act(async () => mountedRoot.unmount());
    mountedRoot = undefined;
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("excludes authentication, API modules and inactive routes from the actual entry graph", () => {
    const entry = path.resolve(process.cwd(), "src/main.jsx");
    const reached = new Set();
    const external = new Set();
    function visitNode(node, visitor) {
      if (!node || typeof node !== "object") return;
      visitor(node);
      for (const [key, value] of Object.entries(node)) {
        if (["loc", "extra"].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(child => visitNode(child, visitor));
        else if (value && typeof value === "object") visitNode(value, visitor);
      }
    }
    function visit(file) {
      if (reached.has(file)) return;
      reached.add(file);
      if (!/\.(js|jsx)$/.test(file)) return;
      const source = fs.readFileSync(file, "utf8");
      const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
      visitNode(ast, node => {
        let spec;
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)) {
          spec = node.source?.value;
        } else if (node.type === "CallExpression" && (node.callee.type === "Import" || node.callee.name === "require")) {
          expect(node.arguments[0]?.type).toBe("StringLiteral");
          spec = node.arguments[0].value;
        }
        if (node.type === "Identifier") {
          expect(["localStorage", "sessionStorage", "indexedDB"].includes(node.name)).toBe(false);
        }
        if (!spec) return;
        if (!spec.startsWith(".")) { external.add(spec); return; }
        const base = path.resolve(path.dirname(file), spec);
        const target = ["", ".js", ".jsx", ".json", ".css", "/index.js", "/index.jsx"]
          .map(extension => base + extension)
          .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        expect(target).toBeTruthy();
        visit(target);
      });
    }
    visit(entry);
    const files = [...reached].map(file => file.replaceAll("\\", "/"));
    expect(files.some(file => file.endsWith("/FraudMonitoringDashboard.jsx"))).toBe(true);
    expect(files.some(file => /\/authentication\/|\/api\/|\/AuthenticatedApp\.jsx$|\/AppRoutes\.jsx$|\/Layout\.jsx$|SandboxTransport/.test(file))).toBe(false);
    expect(external.has("axios")).toBe(false);
    expect(files.some(file => file.endsWith("/FraudDashboardOfflinePreview.jsx"))).toBe(false);
  });
});
