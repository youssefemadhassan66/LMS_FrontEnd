import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Auth from "./Auth";
import { ThemeProvider } from "../../context/ThemeContext";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    signup: vi.fn(),
    loading: false,
    error: null,
    setError: vi.fn(),
  }),
}));

// Renders the router location so assertions can read it without a module
// variable assigned during render.
const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      })}
    </output>
  );
};

const currentLocation = () =>
  JSON.parse(screen.getByTestId("location").textContent);

const renderAt = (entry) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("Auth routes", () => {
  it("opens the sign-in form on /login", () => {
    renderAt("/login");

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens the create-account form on /signup", () => {
    renderAt("/signup");

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });

  it("switching tabs changes the URL and keeps the redirect state", async () => {
    const user = userEvent.setup();
    const from = { pathname: "/dashboard/courses" };
    renderAt({ pathname: "/login", search: "?ref=nav", state: { from } });

    await user.click(screen.getByRole("tab", { name: "Create account" }));

    expect(currentLocation()).toEqual({
      pathname: "/signup",
      search: "?ref=nav",
      state: { from },
    });
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(currentLocation().pathname).toBe("/login");
    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
  });
});
