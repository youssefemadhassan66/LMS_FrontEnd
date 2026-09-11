import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UsersPage from "./UsersPage";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../../hooks/useApiRequest", () => ({
  useApiRequest: () => ({ request: mocks.request }),
}));

const pendingParent = {
  _id: "507f1f77bcf86cd799439011",
  FullName: "Mona Pending",
  UserName: "monapending",
  Email: "mona@example.com",
  role: "parent",
  isActive: true,
  approvalStatus: "pending",
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockImplementation((url) => {
    if (url.startsWith("/api/v1/user?")) {
      return Promise.resolve({ data: { users: [pendingParent], results: 1 } });
    }
    if (url === "/api/v1/user/pending-approvals") {
      return Promise.resolve({ data: { users: [pendingParent] } });
    }
    if (url === "/api/v1/student-instructor-assignments") {
      return Promise.resolve({ data: { assignments: [] } });
    }
    return Promise.resolve({
      status: "success",
      data: { user: { ...pendingParent, approvalStatus: "approved" } },
    });
  });
});

describe("account approval UI", () => {
  it("shows a pending parent to the admin and approves it", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: /pending account approvals/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Mona Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending approval")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith(
        `/api/v1/user/${pendingParent._id}/approval`,
        "PATCH",
        { approvalStatus: "approved" },
      );
    });
  });
});

describe("admin-set passwords", () => {
  it("sends the password exactly as typed when creating a user", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /add user/i }));

    await user.type(screen.getByPlaceholderText("John Doe"), "New Student");
    await user.type(screen.getByPlaceholderText("johndoe"), "newstudent");
    await user.type(screen.getByPlaceholderText("john@example.com"), "new@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "test@1234");

    await user.click(screen.getByRole("button", { name: /^create user$/i }));

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith("/api/v1/user", "POST", {
        FullName: "New Student",
        UserName: "newstudent",
        Email: "new@example.com",
        password: "test@1234",
        role: "student",
      });
    });
  });

  it("opts both password fields out of browser autofill", async () => {
    const user = userEvent.setup();
    renderPage();

    // A password manager filling the admin's own credentials into this field
    // would create the account with a password nobody knows.
    await user.click(await screen.findByRole("button", { name: /add user/i }));
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("autocomplete", "new-password");

    await user.click(screen.getByRole("button", { name: /close dialog/i }));

    await user.click((await screen.findAllByRole("button", { name: /^edit$/i }))[0]);
    expect(screen.getByPlaceholderText(/leave empty to keep/i)).toHaveAttribute("autocomplete", "new-password");
  });

  it("omits the password from the update payload when the field is left empty", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole("button", { name: /^edit$/i }))[0]);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith(`/api/v1/user/${pendingParent._id}`, "PATCH", {
        FullName: pendingParent.FullName,
        UserName: pendingParent.UserName,
        role: pendingParent.role,
      });
    });
  });

  it("includes the password in the update payload when the admin sets one", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole("button", { name: /^edit$/i }))[0]);
    await user.type(screen.getByPlaceholderText(/leave empty to keep/i), " test@1234 ");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith(`/api/v1/user/${pendingParent._id}`, "PATCH", {
        FullName: pendingParent.FullName,
        UserName: pendingParent.UserName,
        role: pendingParent.role,
        password: " test@1234 ",
      });
    });
  });
});
