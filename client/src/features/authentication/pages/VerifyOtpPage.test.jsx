import React, { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyOtpPage from "./VerifyOtpPage";

const fixtures = vi.hoisted(() => ({ location: { state: null }, login: vi.fn(), navigate: vi.fn(), verify: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useLocation: () => fixtures.location,
  useNavigate: () => fixtures.navigate,
  Navigate: ({ to }) => <p role="status">Redirect: {to}</p>,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login: fixtures.login }) }));
vi.mock("../api/authApi", () => ({ verifyOtp: fixtures.verify }));

beforeEach(() => {
  fixtures.location = { state: { email: "SYNTHETIC@EXAMPLE.INVALID" } };
  vi.clearAllMocks();
  const forbidden = () => { throw new Error("LIVE_AUTH_SIDE_EFFECT_FORBIDDEN"); };
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) vi.stubGlobal(name, forbidden);
  for (const name of ["getItem", "setItem", "removeItem", "clear"]) vi.spyOn(Storage.prototype, name).mockImplementation(forbidden);
});
afterEach(() => {
  cleanup();
  document.getElementById("verify-otp-styles")?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function enterOtp() {
  screen.getAllByRole("textbox").forEach((input, index) => fireEvent.change(input, { target: { value: String(index + 1) } }));
}

describe("OTP page offline lifecycle and navigation", () => {
  it("transitions from missing email to a challenge without changing hook order", () => {
    fixtures.location = { state: null };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<StrictMode><VerifyOtpPage /></StrictMode>);
    expect(screen.getByRole("status").textContent).toBe("Redirect: /");
    fixtures.location = { state: { email: "synthetic@example.invalid" } };
    expect(() => rerender(<StrictMode><VerifyOtpPage /></StrictMode>)).not.toThrow();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(errors).not.toHaveBeenCalled();
    expect(fixtures.verify).not.toHaveBeenCalled();
  });

  it("transitions from a challenge to missing email without rendering fewer hooks", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<VerifyOtpPage />);
    fixtures.location = { state: null };
    expect(() => rerender(<VerifyOtpPage />)).not.toThrow();
    expect(screen.getByRole("status").textContent).toBe("Redirect: /");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps incomplete OTP disabled and labels all six numeric inputs", () => {
    render(<VerifyOtpPage />);
    for (let digit = 1; digit <= 6; digit++) {
      expect(screen.getByRole("textbox", { name: `OTP digit ${digit}` }).inputMode).toBe("numeric");
    }
    fireEvent.change(screen.getByRole("textbox", { name: "OTP digit 1" }), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Verify OTP" }).disabled).toBe(true);
    expect(fixtures.verify).not.toHaveBeenCalled();
  });

  it("authenticates only after the mocked complete OTP response", async () => {
    const user = { id: "synthetic-user", name: "Synthetic", email: "synthetic@example.invalid" };
    fixtures.verify.mockResolvedValueOnce({ data: { token: "synthetic-token", user } });
    render(<VerifyOtpPage />);
    enterOtp();
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify OTP" }));
    await waitFor(() => expect(fixtures.login).toHaveBeenCalledExactlyOnceWith("user", "synthetic-token", user));
    expect(fixtures.verify).toHaveBeenCalledExactlyOnceWith({ email: "synthetic@example.invalid", otp: "123456" });
    expect(fixtures.navigate).toHaveBeenCalledExactlyOnceWith("/monkey-game", { replace: true });
  });

  it("uses the existing protected user home route for a prior-prize response", async () => {
    fixtures.verify.mockResolvedValueOnce({ data: { token: "synthetic-token", user: { hasPrize: true } } });
    render(<VerifyOtpPage />);
    enterOtp();
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify OTP" }));
    await waitFor(() => expect(fixtures.navigate).toHaveBeenCalledExactlyOnceWith("/user/home", { replace: true }));
    expect(fixtures.login).toHaveBeenCalledTimes(1);
  });

  it("keeps authentication and navigation unchanged when verification fails", async () => {
    fixtures.verify.mockRejectedValueOnce({ response: { data: { message: "Invalid or expired OTP" } } });
    render(<VerifyOtpPage />);
    enterOtp();
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify OTP" }));
    expect(await screen.findByText("Invalid or expired OTP")).toBeTruthy();
    expect(fixtures.login).not.toHaveBeenCalled();
    expect(fixtures.navigate).not.toHaveBeenCalled();
  });
});
