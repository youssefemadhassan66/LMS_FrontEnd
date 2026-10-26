import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UsersPage from "./UsersPage";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../../hooks/useApiRequest", () => ({
  useApiRequest: () => ({ request: mocks.request }),
}));

const person = (i, role, extra = {}) => ({
  _id: `id${String(i).padStart(22, "0")}`,
  FullName: `${role[0].toUpperCase()}${role.slice(1)} Person ${i}`,
  UserName: `${role}${i}`,
  Email: `${role}${i}@example.com`,
  role,
  isActive: true,
  approvalStatus: "approved",
  ...extra,
});

// 100 students on the first page and a second page with the rest: the old
// page only ever showed the first page.
const firstBatch = Array.from({ length: 100 }, (_, i) => person(i, "student"));
const secondBatch = [
  person(100, "parent"),
  person(101, "instructor"),
  person(102, "admin"),
  { ...person(103, "student"), FullName: "Zeinab Late", Email: "zeinab@example.com" },
  person(104, "parent", { isActive: false }),
];

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockImplementation((url) => {
    if (url.startsWith("/api/v1/user?")) {
      const page = new URLSearchParams(url.split("?")[1]).get("page");
      const users = page === "1" ? firstBatch : page === "2" ? secondBatch : [];
      return Promise.resolve({ data: { users, results: users.length } });
    }
    if (url === "/api/v1/user/pending-approvals") return Promise.resolve({ data: { users: [] } });
    if (url === "/api/v1/student-instructor-assignments") return Promise.resolve({ data: { assignments: [] } });
    return Promise.resolve({});
  });
});

const renderPage = async () => {
  render(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  );
  // The headcount appears once every batch is in.
  await screen.findByText(/^105 people/);
};

describe("users list", () => {
  it("loads every page of users, not just the first", async () => {
    await renderPage();

    expect(screen.getByText(/^105 people · 101 students · 2 parents · 1 instructor · 1 admin$/)).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith("/api/v1/user?page=2&limit=100");
  });

  it("finds a user from the second batch by name or email", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByRole("searchbox", { name: /search users/i }), "zeinab@");

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Zeinab Late" })).toBeInTheDocument();
  });

  it("counts matches per role and filters by the chosen tab", async () => {
    const user = userEvent.setup();
    await renderPage();

    const parentsTab = screen.getByRole("tab", { name: /parents/i });
    expect(parentsTab).toHaveTextContent("2");

    await user.click(parentsTab);
    expect(parentsTab).toHaveAttribute("aria-selected", "true");
    expect(bodyRows()).toHaveLength(2);
  });

  it("filters by status and offers a way back from an empty result", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: /filter by status/i }), "inactive");
    expect(bodyRows()).toHaveLength(1);

    await user.type(screen.getByRole("searchbox", { name: /search users/i }), "nobody-matches");
    expect(screen.getByText("No one matches these filters")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByRole("searchbox", { name: /search users/i })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: /filter by status/i })).toHaveValue("all");
  });

  it("keeps deactivation one step away, inside the Edit dialog", async () => {
    const user = userEvent.setup();
    await renderPage();

    // No destructive button sits in the table rows.
    expect(within(screen.getByRole("table")).queryByRole("button", { name: /delete|deactivate/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit Student Person 0" }));
    await user.click(screen.getByRole("button", { name: /deactivate this account/i }));

    expect(await screen.findByText("Deactivate User")).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to deactivate/i)).toHaveTextContent("Student Person 0");
  });
});
